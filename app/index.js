const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const app = express()

app.use(express.json())
app.use(cors())

const port = 8080

const dataDir = process.argv[2]

if (!dataDir || !fs.existsSync(dataDir)) {
  console.error('Please supply a valid output directory as an command-line argument!')
  process.exit(1)
}

const commons = require('./lib/commons')
const json = require('./lib/json')

function sendTiff (res, tiff, filename) {
  res.writeHead(200, {
    'Content-Type': 'image/tiff',
    'Content-disposition': `attachment;filename=${filename}`,
    'Content-Length': tiff.length
  })
  res.end(tiff)
}

app.get('/', async (req, res) => {
  res.send({
    status: 'running!'
  })
})

app.get('/commons/geojson', async (req, res) => {
  const title = req.query.title
  const rectification = await commons.getRectification(title)
  res.send(rectification.geoMask)
})

app.get('/commons/geotiff', async (req, res) => {
  const title = req.query.title
  const rectification = await commons.getRectification(title)
  const geotiff = await commons.warpImage(title, rectification, dataDir)

  const name = title.replace(/^File:/, '')
  const parsed = path.parse(name)

  sendTiff(res, geotiff, `${parsed.name}-warped.tiff`)
})

app.post('/json/geojson', async (req, res) => {
  // TODO: check req.body against JSON Schema!!!!!!!1

  const rectification = await json.getRectification(req.body)
  res.send(rectification.geoMask)
})

app.post('/json/geotiff', async (req, res) => {
  const rectification = await json.getRectification(req.body)

  const geotiff = await json.warpImage(req.body, rectification, dataDir)
  sendTiff(res, geotiff, 'warped.tiff')
})

app.listen(port, () => console.log(`Georectify service listening on port ${port}!`))
