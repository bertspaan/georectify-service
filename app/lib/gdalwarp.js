const fs = require('fs')
const path = require('path')
const exec = require('child_process').exec

function gdalCommands (name, gcps) {
  const script = `
gdal_translate -of vrt \\
  -a_srs EPSG:4326 \\
  ${gcps.map((gcp) => `-gcp ${gcp.join(' ')}`).join(' ')} \\
  "${name}.jpg" \\
  "${name}.vrt"

gdalwarp -co TILED=YES \\
  -co COMPRESS=JPEG -co JPEG_QUALITY=80 \\
  -dstalpha -overwrite \\
  -cutline "${name}.geojson" -crop_to_cutline \\
  -t_srs "EPSG:4326" \\
  "${name}.vrt" \\
  "${name}-warped.tiff"`

  return script
}

function runCommand (command, dir) {
  return new Promise((resolve, reject) => {
    exec(command, {
      cwd: dir
    }, (err, stdout, stderr) => {
      if (err) {
        reject(err, stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

module.exports = async function (name, image, gcps, mask, dataDir) {
  const geojsonName = `${name}.geojson`
  const scriptName = `${name}.sh`

  // It seems that gdal_translate expects a different lat/lon order
  // than gdaltransform... WHY?!
  const script = gdalCommands(name, gcps.map((gcp) => ([
    gcp[0],
    gcp[1],
    gcp[3],
    gcp[2]
  ])))

  fs.writeFileSync(path.join(dataDir, `${name}.jpg`), image)
  fs.writeFileSync(path.join(dataDir, geojsonName), JSON.stringify(mask, null, 2))
  fs.writeFileSync(path.join(dataDir, scriptName), script)

  const command = `bash "${path.join(dataDir, scriptName)}"`
  await runCommand(command, dataDir)

  const warpedFilename = path.join(dataDir, `${name}-warped.tiff`)

  const geotiff = fs.readFileSync(warpedFilename)
  return Buffer.from(geotiff, 'binary')
}
