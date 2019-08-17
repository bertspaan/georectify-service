const path = require('path')
const axios = require('axios')
const querystring = require('querystring')
const turf = require('@turf/turf')

const gdalTransform = require('./gdaltransform.js')
const gdalWarp = require('./gdalwarp.js')

const apiBaseUrl = 'https://commons.wikimedia.org/w/api.php'
// const mapDataUrl = (title) => `${apiBaseUrl}?action=query&format=json&prop=mapdata&titles=${encodeURIComponent(title)}`
const imageInfoUrl = (title) => `${apiBaseUrl}?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent(title)}&iiprop=size%7Curl`

const exportBaseUrl = 'https://commons.wikimedia.org/wiki/Special:Export'

const firstPageFromResponse = (response, key) => Object.values(response.data.query.pages)[0][key][0]

async function getTabData (title, type) {
  const parsed = path.parse(title)
  const tabTitle = parsed.name.replace(/^File:/, 'Data:') + `.${type}.tab`

  const response = await axios.post(exportBaseUrl, querystring.stringify({
    pages: tabTitle,
    curonly: 1
  }))

  const xml = response.data
  const json = xml.match(/<text.*?>(.*)<\/text>/)
  return JSON.parse(json[1]).data
}

// async function getMapData (title) {
//   const parsed = path.parse(title)
//   const georefTitle = parsed.name.replace(/^File:/, 'Data:') + '.georef.map'

//   const response = await axios.get(mapDataUrl(georefTitle))
//   const mapDataString = firstPageFromResponse(response, 'mapdata')
//   const mapData = Object.values(JSON.parse(mapDataString))[0][0]

//   return mapData
// }

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

async function getRectification (title) {
  if (!title.startsWith('File:')) {
    throw new Error('Title should be in the File namespace!')
  }

  const percentageMask = await getTabData(title, 'mask')
  const percentageGcps = await getTabData(title, 'gcps')

  const imageInfo = await getImageInfo(title)
  const dimensions = [imageInfo.width, imageInfo.height]

  const pixelMask = percentageMask.map((coordinate) => ([
    coordinate[0] * dimensions[0],
    coordinate[1] * dimensions[1]
  ]))

  const gcps = percentageGcps.map((gcp) => ([
    gcp[0] * dimensions[0],
    gcp[1] * dimensions[1],
    gcp[2],
    gcp[3]
  ]))

  const geoMask = await gdalTransform(pixelMask, gcps)

  const feature = {
    type: 'Feature',
    properties: {
      sources: [
        {
          id: title,
          type: 'wikimedia-commons',
          url: `https://commons.wikimedia.org/wiki/${title}`
        }
      ],
      area: Math.round(turf.area(geoMask))
    },
    geometry: geoMask
  }

  return {
    gcps,
    pixelMask,
    geoMask: feature
  }
}

async function warpImage (title, rectification, dataDir) {
  const imageInfo = await getImageInfo(title)
  const image = await downloadImage(imageInfo.url)

  const name = title.replace(/^File:/, '')
  const parsed = path.parse(name)

  return gdalWarp(parsed.name, image, rectification.gcps, rectification.geoMask, dataDir)
}

module.exports = {
  getRectification,
  warpImage
}
