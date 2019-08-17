const path = require('path')
const axios = require('axios')
const turf = require('@turf/turf')

const gdalTransform = require('./gdaltransform.js')
const gdalWarp = require('./gdalwarp.js')

async function downloadIIIFImage (url, dimensions) {
  const fullJpgUrl = `${url}/0,0,${dimensions[0]},${dimensions[1]}/${dimensions[0]},${dimensions[1]}/0/default.jpg`

  const response = await axios.get(fullJpgUrl, {
    responseType: 'arraybuffer'
  })

  return response.data
}

async function getRectification (imageData) {
  const map = imageData.maps[0]
  const source = imageData.sources[0]

  const pixelMask = map.mask.map((coordinate) => ([
    coordinate[0] * source.dimensions[0],
    coordinate[1] * source.dimensions[1]
  ]))

  const gcps = map.gcps.map((gcp) => ([
    gcp.image[0] * source.dimensions[0],
    gcp.image[1] * source.dimensions[1],
    gcp.world[0],
    gcp.world[1]
  ]))

  const geoMask = await gdalTransform(pixelMask, gcps)

  const feature = {
    type: 'Feature',
    properties: {
      sources: imageData.sources,
      area: Math.round(turf.area(geoMask))
    },
    geometry: geoMask
  }

  return {
    pixelMask,
    geoMask: feature,
    gcps
  }
}

async function warpImage (imageData, rectification, dataDir) {
  // TODO: also check other sources
  const source = imageData.sources[0]

  if (source.type !== 'iiif') {
    throw new Error('Only IIIF URLs are supported!')
  }

  const image = await downloadIIIFImage(source.url, source.dimensions)
  const name = path.parse(source.url).name

  return gdalWarp(name, image, rectification.gcps, rectification.geoMask, dataDir)
}

module.exports = {
  getRectification,
  warpImage
}
