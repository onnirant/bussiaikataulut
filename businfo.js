/*
    businfo.js

    version: 0.3
    date: 2020-05-30
    author: Onni Räntilä
    license: Näytä nimi, käytä vapaasti

    Hakee seuraavaksi lähtevät bussit Honkapirtin infonäytön kyseiselle dialle.
    Korvaa Ville Perkkiön bus-info.js versio 1.7:n.

*/

$(document).ready(function(){ // jQuery basics, suoritetaan skripti vasta, kun sivu on renderöity valmiiksi

    let INTERVAL = 60000 // Päivitysväli millisekunteina, 60000 ms = 1 min

    /*
    * Hakee kaupungin API:sta JSON-tiedoston pysäkkikoodin (stopCode) perusteella, järjestää ne aikajärjestykseen ja piirtää ne parametrina annettuihin taulukkoriveihin
    */
    function getDepartureTimes(stopCode, targets) {
        
        //Ville Perkkiön käyttämä kaupungin joukkoliikenneosaston API, en tiedä tästä sen kummemmin. Palauttaa nätin JSON-objektin. Esimerkkivastaus on tiedostossa api-data.json.
        //let fetchURI = "https://jl.oulunliikenne.fi/api/web/v1/schedule/departures?citySymbol=OULU&fullSchedule=false&stopGroupDepartures=false&stopCode=" + stopCode;
        
        //Tällä hetkellä (25.5.2023) toimiva API
        let fetchURI = "https://jl.oulunliikenne.fi/api/fara/schedule/departures?citySymbol=FI_OULU&fullSchedule=false&stopGroupDepartures=false&stopCode=" + stopCode;

        $.ajax({
        cache: false,
        url: fetchURI,
        dataType: "json",
        success: function(result){ // Haetaan JSON, joka sisältää pysäkin lähtevien bussien tiedot, tiedot ovat muuttujassa "result"
            let departureList = []; // Array, johon kerätään lähtevien bussien pysäkkinimi, linjanumero, määränpää, lähtöaika, ja onko lähtöaika reaaliaikainen (GPS)

            result.stops[0].lines.forEach(line => { // Käydään JSON läpi bussilinja kerrallaan
                
                if(line.departures !== undefined) { // Ei suoriteta, jos linjalla ei ole tulevia lähtöjä aikataulussa

                    let departure, time, isrealtime;

                    for(i=0; i < 2; i++) { // Haetaan kaksi seuraavaksi lähtevää vuoroa
                        if(line.departures[i]) { // ..jos niitä on
                            if(line.departures[i].departureRealtime) { 
                                time = new Date(line.departures[i].departureRealtime);
                                isrealtime = true;
                            } else if(line.departures[i].departureSchedule) {
                                time = new Date(line.departures[i].departureSchedule);
                                isrealtime = false;
                            }

                            let currentTime = new Date(); // Nykyinen aika JS:n Date-muodossa
                            // Lasketaan aikaerotus lähtöajan ja nykyajan välillä
                            let diff = new Date(time.getTime() - currentTime.getTime()); // Lähtöaika - nykyaika millisekunneissa
                            let hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); // Lasketaan aikaeron tunnit, pyöristetään alas
                            let minutes = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60)); // Lasketaan aikaeron minuutit, pyöristetään ylös
        
                            departure = {
                                "stopname": result.stops[0].stopName, // Pysäkin nimi
                                "line": line.lineName, // Linjan numero
                                "destination": line.departures[i].headingTextOverride, // Linjan määränpää, se, mikä näkyy bussin etuosassa
                                "time": time, // Lähtöaika timestampina
                                "hoursToDeparture": hours, //lähtöön aikaa tunteja
                                "minutesToDeparture": minutes, //lähtöön aikaa minuutteja
                                "realtime": isrealtime // Onko lähtöaika reaaliaikainen (GPS) vai aikataulun mukainen
                            };

                            if(!(stopCode == "1648" && line.lineName != "22" && line.lineName !="19")) { // Erikoisehto tapaukselle, jos pysäkki on Pateniemenranta E, näytetään vain linjan 22 seuraava lähtö, koska ainoastaan 22 ja 19 kääntyvät ennen Aaltokangas E
                                if(departure.minutesToDeparture > 0) { // Lisätään vain, jos lähtöön on minuutti tai enemmän
                                    /*if(!((stopCode == "1654" || stopCode == "1655" || stopCode == "1648") && departure.minutesToDeparture < 4)) { // Jos kyseessä on Aaltokankaantien/Pateniemenrannan pysäkit, näytetään vain jos lähtöön on yli neljä minuuttia*/
                                        departureList.push(departure); // Lisätään lähtevien vuorojen listaan 
                                    /*}*/
                                }
                                
                            }
                        }
                    }
                }
            })

        departureList.sort(function(a, b){return a.time - b.time}); //Järjestetään bussien lähdöt aikajärjestykseen

        console.log(departureList);

        for(i = 0; i < targets.length; i++) { // Toistetaan sen mukaan, montako taulukkoriviä täytetään, 1 kerta jos kyseessä Honkapirtin pysäkki, 3 kertaa jos Aaltokankaantie P/E
            let timeString = "";
            let d = departureList[i];

            if (d.hoursToDeparture > 0) { // Lähtöön on yli tunti, näytetään lähtö kellonaikana hh:mm

                timeString = d.time.getHours() + ":" + d.time.getMinutes()<10?'0':'' + d.time.getMinutes();

            } else { // Lähtöön on alle tunti, näytetään lähtö minuutteina nykyhetkestä
                
                timeString = d.minutesToDeparture + " min";

                // Jos lähtöaika ei ole reaaliaikainen, laitetaan ajan alkuun noin-merkki: ~
                if(!d.realtime) {
                    timeString = "~" + timeString;
                }
                
            }

            // Jos lähtö oli ok (lähtee yli tunnin päästä ja ei ole juuri nyt pysäkillä), siirretään tiedot esille html-taulukkoon, oletetaan että ne ovat näillä css-classeilla, esim .lineName2, ks. bussit.html tai infotaulun bussiaikatauludia
            if(timeString != "") {
                $("td.stopName" + targets[i]).html(d.stopname);
                $("td.lineName" + targets[i]).html(d.line + " " + d.destination);
                $("td.departures" + targets[i]).html(timeString);
            }
            

        }

        }});
    }

    //Funktio, joka piirtää aikataulutaulukon, ensimmäinen attribuutti on pysäkkikoodi (stopCode, nämä ovat helposti saatavissa ihan fyysisesti pysäkistä johonkin merkattuna, tai käyttämällä jl.oulunliikenne.fi), toinen attribuutti sisältää taulukon rivinumerot, jotka täytetään
    function drawTimetable () {
        /*getDepartureTimes("1658", [0]); // Honkapirtti P
        getDepartureTimes("1654", [1, 2, 3]); // Aaltokankaantie P
        getDepartureTimes("1663", [4]); // Honkapirtti E
        getDepartureTimes("1655", [5, 6, 7, 8]); // Aaltokankaantie E

        // Jos on Ma-Pe, näytetään Pateniemenrannan pysäkin 22 ja 19 lähdöt
        let currentTime = new Date();
        let dayofweek = currentTime.getDay();
        if(dayofweek >= 0 && dayofweek <= 5) {
            getDepartureTimes("1648", [9]); // Pateniemenranta E
        } */

        getDepartureTimes("2016", [0,1,2,3,4,5,6,7,8,9]); // Kaupungintalo P
        getDepartureTimes("2087", [10,11,12,13,14,15,16,17,18,19]); // Kaupungintalo E
    }

    drawTimetable();
    setInterval(drawTimetable, INTERVAL); // Päivitetään taulukko INTERVAL:n määräämän aikavälin mukaan

    

});
