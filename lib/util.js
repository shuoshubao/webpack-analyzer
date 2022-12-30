import * as echarts from 'echarts/core'
import { TreemapChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { last, get, find, map, add, uniq, uniqBy, cloneDeep, intersection, isPlainObject } from 'lodash-es'
import { inflateRaw } from 'pako/dist/pako_inflate.js'
import filesize from 'filesize'
import traverse from 'traverse'
import { name as pkgName } from '../package'

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer])

export const SiderWidthKey = [pkgName, 'sider-width'].join('-')

export const CollapsedKey = [pkgName, 'sider-collapsed'].join('-')

const inflateData = str => {
  return JSON.parse(inflateRaw(new Uint8Array(str.split(',')), { to: 'string' }))
}

window.OriginalWebpackData = window.WebpackData

window.WebpackData = inflateData(window.OriginalWebpackData)

const { WebpackData } = window

const { assetsByChunkName } = WebpackData

const assets = WebpackData.assets.filter(v => v.name.endsWith('.js'))

const chunkFilterFn = item => {
  const { moduleType, name } = item
  return (
    !['runtime', 'css/mini-extract'].includes(moduleType) &&
    !name.startsWith('external') &&
    !name.startsWith('delegated')
  )
}

const chunks = WebpackData.chunks.map(v => {
  return {
    ...v,
    modules: v.modules.filter(chunkFilterFn)
  }
})

const modules = WebpackData.modules.filter(chunkFilterFn)

const allModules = uniqBy(
  chunks.reduce((prev, cur) => {
    prev.push(...cur.modules)
    return prev
  }, modules),
  'name'
)

assets.forEach(v => {
  const { chunks: chunkIds } = v
  const filterModules = chunkIds.reduce((prev, cur) => {
    const item = find(chunks, { id: cur })
    prev.push(...item.modules)
    return prev
  }, [])

  const moduleIdList = uniq(map(filterModules, 'id'))

  v.statSize = moduleIdList
    .map(v2 => {
      const { size } = find(allModules, { id: v2 })
      return size
    })
    .reduce(add, 0)
})

const chunksList = map(assets, 'name')

export { assetsByChunkName, assets, chunks, modules, allModules, chunksList }

export const getFileSize = size => {
  return filesize(size || 0, { base: 2, standard: 'jedec' })
}

export const isDark = () => {
  const { matchMedia } = window
  return matchMedia('(prefers-color-scheme: dark)').matches
}

export const addListenerPrefersColorScheme = callback => {
  const { matchMedia } = window
  matchMedia('(prefers-color-scheme: dark)').addListener(mediaQueryList => {
    callback(mediaQueryList.matches)
  })
  matchMedia('(prefers-color-scheme: light)').addListener(mediaQueryList => {
    callback(!mediaQueryList.matches)
  })
}

const perf = obj => {
  const temp = cloneDeep(obj)
  traverse(temp).forEach(function () {
    if (this.notRoot) {
      this.after(function () {
        if (this.node?.children?.length === 1) {
          this.update(this.node.children[0])
        }
      })
    }
  })

  traverse(temp).forEach(function () {
    if (this.notRoot) {
      this.before(function () {
        if (isPlainObject(this.node)) {
          const name = this.node.path.replace(get(temp, [...this.path.slice(0, -2), 'path'].join('.')) + '/', '')
          this.update({ name, ...this.node })
        }
      })
    }
  })
  return temp
}

const pathsToTree = (paths = []) => {
  const resultKey = Symbol()
  const result = []
  const level = { [resultKey]: result }

  paths.sort().forEach(path => {
    path.split('/').reduce((prev, cur, index, arr) => {
      if (!prev[cur]) {
        prev[cur] = {
          [resultKey]: []
        }
        const curPath = arr.slice(0, index + 1).join('/')
        const item = find(allModules, { name: `./${curPath}` }) || find(allModules, { name: curPath })
        prev[resultKey].push({
          path: curPath,
          value: item?.size,
          children: prev[cur][resultKey]
        })
      }

      return prev[cur]
    }, level)
  })
  return perf(result)
}

export const renderChart = (chartRef, { checkedChunks }) => {
  if (!checkedChunks.length) {
    echarts.getInstanceByDom(chartRef.current)?.dispose()
    return
  }

  const treeData = intersection(chunksList, checkedChunks).map(v => {
    const name = last(v.split('/'))

    const { chunks: chunkIds } = find(assets, { name: v })

    const filterModules = chunkIds.reduce((prev, cur) => {
      const item = find(chunks, { id: cur })
      prev.push(...item.modules)
      return prev
    }, [])

    const moduleNameList = uniq(map(filterModules, 'name'))

    return {
      name: name,
      path: name,
      children: pathsToTree(
        moduleNameList.map(v2 => {
          if (v2.startsWith('./')) {
            return v2.replace('./', '')
          }
          return v2
        })
      )
    }
  })

  const option = {
    tooltip: {
      formatter: info => {
        const { value, data } = info
        const { path } = data
        return [
          '<div style="color: #000000d9;">',
          `<div>Size: <strong>${getFileSize(value)}</strong></div>`,
          `<div>Path: <strong>./${path}</strong></div>`,
          '</div>'
        ].join('')
      }
    },
    series: [
      {
        name: 'App',
        type: 'treemap',
        leafDepth: 5,
        width: '100%',
        height: '100%',
        label: {
          padding: 0
        },
        upperLabel: {
          show: true,
          height: 30,
          textBorderColor: 'inherit',
          backgroundColor: 'transparent'
        },
        breadcrumb: {
          show: true,
          height: 30,
          bottom: 10
        },
        roam: false,
        itemStyle: {
          borderColor: 'transparent'
        },
        emphasis: {},
        levels: [
          {
            itemStyle: {
              borderColor: '#999',
              borderWidth: 5,
              gapWidth: 5
            },
            upperLabel: {
              show: false
            }
          },
          {
            itemStyle: {
              borderWidth: 5,
              gapWidth: 5,
              borderColorSaturation: 0.55
            }
          },
          {
            itemStyle: {
              borderWidth: 5,
              gapWidth: 5,
              borderColorSaturation: 0.6
            }
          },
          {
            itemStyle: {
              borderWidth: 3,
              gapWidth: 3,
              borderColorSaturation: 0.65
            }
          },
          {
            itemStyle: {
              borderWidth: 3,
              gapWidth: 3,
              borderColorSaturation: 0.7
            }
          },
          {
            itemStyle: {
              borderWidth: 3,
              gapWidth: 3,
              borderColorSaturation: 0.75
            }
          }
        ],
        data: treeData
      }
    ]
  }

  const myChart = echarts.init(chartRef.current)

  setTimeout(() => {
    myChart.setOption(option)
  }, 0)

  window.addEventListener('resize', () => {
    myChart.resize()
  })
}
