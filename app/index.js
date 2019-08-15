const fs = require('fs')
const path = require('path')
const axios = require('axios')
const exec = require('child_process').exec
const express = require('express')
const app = express()
const port = 8080

const dataDir = process.argv[2]

if (!dataDir || !fs.existsSync(dataDir)) {
  console.error('Please supply a valid output directory as an command-line argument!')
  process.exit(1)
}

const apiBaseUrl = 'https://commons.wikimedia.org/w/api.php'
const mapDataUrl = (title) => `${apiBaseUrl}?action=query&format=json&prop=mapdata&titles=${encodeURIComponent(title)}`
const imageInfoUrl = (title) => `${apiBaseUrl}?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent(title)}&iiprop=size%7Curl`

const firstPageFromResponse = (response, key) => Object.values(response.data.query.pages)[0][key][0]

async function getMapData (title) {
  const parsed = path.parse(title)
  const georefTitle = parsed.name.replace(/^File:/, 'Data:') + '.georef.map'

  const response = await axios.get(mapDataUrl(georefTitle))
  const mapDataString = firstPageFromResponse(response, 'mapdata')
  const mapData = Object.values(JSON.parse(mapDataString))[0][0]

  return mapData
}

async function getImageInfo (title) {
  const response = await axios.get(imageInfoUrl(title))
  const imageInfo = firstPageFromResponse(response, 'imageinfo')
  return imageInfo
}

async function downloadImage (url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer'
  })

  return response.data
}

function gdalCommands (name, gcps) {
  const parsed = path.parse(name)

  const script = `
gdal_translate -of vrt \\
  -a_srs EPSG:4326 \\
  ${gcps.map((gcp) => `-gcp ${gcp.join(' ')}`).join(' ')} \\
  "${name}" \\
  "${parsed.name}.vrt"

gdalwarp -co TILED=YES \\
  -co COMPRESS=JPEG -co JPEG_QUALITY=80 \\
  -dstalpha -overwrite \\
  -cutline "${parsed.name}.geojson" -crop_to_cutline \\
  -t_srs "EPSG:4326" \\
  "${parsed.name}.vrt" \\
  "${parsed.name}-warped.tiff"`

  return script
}

app.get('/', async (req, res) => {
  res.send({
    status: 'running!'
  })
})

app.get('/:title', async (req, res) => {
  const imageTitle = req.params.title

  if (!imageTitle.startsWith('File:')) {
    res.status(404).send('No!')
    return
  }

  const mapData = await getMapData(imageTitle)
  const imageInfo = await getImageInfo(imageTitle)

  const image = await downloadImage(imageInfo.url)

  const mask = mapData.features
    .filter((feature) => feature.properties.type === 'mask')[0]
    .geometry

  const dimensions = [imageInfo.width, imageInfo.height]

  const gcps = mapData.features
    .filter((feature) => feature.properties.type === 'gcp')
    .map((feature) => ([
      feature.properties.pixel[0] * dimensions[0],
      feature.properties.pixel[1] * dimensions[1],
      feature.geometry.coordinates[0],
      feature.geometry.coordinates[1]
    ]))

  const name = imageTitle.replace(/^File:/, '')
  const parsed = path.parse(name)
  const geojsonName = `${parsed.name}.geojson`
  const scriptName = `${parsed.name}.sh`

  const script = gdalCommands(name, gcps)

  fs.writeFileSync(path.join(dataDir, name), image)
  fs.writeFileSync(path.join(dataDir, geojsonName), JSON.stringify(mask, null, 2))
  fs.writeFileSync(path.join(dataDir, scriptName), script)

  exec(`bash "${path.join(dataDir, scriptName)}"`, {
    cwd: dataDir
  }, (err, stdout, stderr) => {
    if (err) {
      res.status(500).send(stderr)
    } else {
      const warpedFilename = path.join(dataDir, `${parsed.name}-warped.tiff`)
      const stats = fs.statSync(warpedFilename)

      const geotiff = fs.readFileSync(warpedFilename)

      res.writeHead(200, {
        'Content-Type': 'image/tiff',
        'Content-disposition': `attachment;filename=${parsed.name}-warped.tiff`,
        'Content-Length': stats.size
      })
      res.end(Buffer.from(geotiff, 'binary'))
    }
  })
})

app.listen(port, () => console.log(`Georectify service listening on port ${port}!`))
