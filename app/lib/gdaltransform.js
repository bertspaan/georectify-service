const H = require('highland')

const spawn = require('child_process').spawn

const transformArgs = {
  auto: '',
  p1: '-order 1',
  p2: '-order 2',
  p3: '-order 3',
  tps: '-tps'
}

module.exports = function (mask, gcps, params) {
  return new Promise((resolve, reject) => {
    if (!params) {
      params = {}
    }

    let gdalArgs = []
    gcps.forEach((gcp) => {
      gdalArgs.push('-gcp')
      gdalArgs = gdalArgs.concat(gcp)
    })

    if (params.transform) {
      const transformArg = transformArgs[params.transform]

      if (transformArg === undefined) {
        reject(new Error('Transform option is invalid: ' + params.transform))
        return
      }

      if (transformArg.length) {
        gdalArgs = gdalArgs.concat(transformArg.split(' '))
      }
    }

    let error = false
    const gdal = spawn('gdaltransform', gdalArgs)
    gdal.stdin.setEncoding('utf-8')

    gdal.on('error', (err) => {
      error = true
      reject(new Error('Error spawning gdaltransform - is GDAL installed? ' + err.message))
    })

    H(gdal.stdout)
      .split()
      .compact()
      // each line contains latitude, longitude and elevation
      .map((line) => line.split(' ').slice(0, 2).map(parseFloat))
      .map((latLon) => [latLon[1], latLon[0]])
      .toArray((coordinates) => {
        if (!error) {
          resolve({
            type: 'Polygon',
            coordinates: [
              coordinates
            ]
          })
        }
      })

    mask.forEach((coordinate) => {
      gdal.stdin.write(`${coordinate.join(' ')}\n`)
    })
    gdal.stdin.end()
  })
}
