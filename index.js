const { readFileSync, writeFileSync } = require('fs')
const { resolve } = require('path')
const { pick, map, find, add, uniqBy } = require('lodash')
const { deflateRaw } = require('pako')
const { name: pkgName, version } = require('./package.json')

const getFileContent = fileName => {
  return readFileSync(resolve(__dirname, fileName)).toString()
}

const deflateData = data => {
  return deflateRaw(JSON.stringify(data).toString())
}

const defaultOptions = {
  filename: 'WebpackAnalyzer.html'
}

module.exports = class {
  constructor(options = {}) {
    this.options = {
      ...defaultOptions,
      ...options
    }
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync(pkgName, (stats, callback) => {
      const data = pick(stats.toJson(), 'outputPath', 'assetsByChunkName', 'assets', 'chunks', 'modules')

      const assetsByChunkName = Object.entries(data.assetsByChunkName).reduce((prev, [k, v]) => {
        prev[k] = v.find(v2 => v2.endsWith('.js'))
        return prev
      }, {})

      const assets = data.assets.map(v => {
        return pick(v, 'type', 'name', 'size', 'chunks', 'chunkNames')
      })

      const chunks = data.chunks.map(v => {
        return {
          ...pick(v, 'id', 'size'),
          modules: v.modules.map(v2 => {
            return pick(v2, 'name', 'type', 'moduleType', 'size', 'index', 'id', 'chunks', 'depth')
          })
        }
      })

      const modules = data.modules.map(v => {
        return pick(v, 'type', 'moduleType', 'size', 'name', 'id', 'chunks', 'depth')
      })

      const WebpackAnalyzeData = { assetsByChunkName, assets, chunks, modules }

      const html = getFileContent('./index.html')
        .replace('dist/index.js', `https://unpkg.com/${pkgName}@${version}/dist/index.js`)
        .replace(
          '<script src="docs/WebpackData.js">',
          `<script>window.WebpackData = '${deflateData(WebpackAnalyzeData)}'`
        )

      writeFileSync(resolve(data.outputPath, this.options.filename), html)

      callback()
    })
  }
}
