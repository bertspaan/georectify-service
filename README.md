# Georectify Web Service

Warps maps, computes GeoJSON masks!

- __Input__: https://github.com/bertspaan/georectify-json-spec
- __Output__: GeoJSON or GeoTIFF

## Run

Standalone:

    cd app
    npm install
    node index.js

Docker:

    docker-compose build
    docker-compose up

Then the web service run on http://localhost:8080!

## Wikimedia Commons

- GeoJSON mask:

    curl "http://localhost:8080/commons/geojson?title=File%3APigot_and_Co_%281842%29_p2.138_-_Map_of_Lancashire.jpg"

- GeoTIFF:

    curl "http://localhost:8080/commons/geotiff?title=File%3APigot_and_Co_%281842%29_p2.138_-_Map_of_Lancashire.jpg" -o lancashire.tiff

## JSON

- GeoJSON mask

    curl -X POST http://localhost:8080/json/geojson -d @davidrumsey-30297022227.json  --header "Content-Type: application/json"

- GeoTIFF:

    curl -X POST http://localhost:8080/json/geotiff -d @davidrumsey-30297022227.json  --header "Content-Type: application/json" -o 30297022227.tiff
