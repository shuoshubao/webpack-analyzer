import React, { useRef, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Layout, Typography, Select, Checkbox, Radio } from 'antd'
import { Resizable } from 're-resizable'
import * as echarts from 'echarts/core'
import { TreemapChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { last, get, find, map, add, uniq, uniqBy, sortBy, cloneDeep, intersection, isPlainObject } from 'lodash-es'
import { inflateRaw } from 'pako/dist/pako_inflate.js'
import filesize from 'filesize'
import traverse from 'traverse'
import { name as pkgName } from '../package'

const SiderWidthKey = [pkgName, 'sider-width'].join('-')
const CollapsedKey = [pkgName, 'sider-collapsed'].join('-')

const inflateData = str => {
  return JSON.parse(inflateRaw(new Uint8Array(str.split(',')), { to: 'string' }))
}

window.OriginalWebpackData = cloneDeep(window.WebpackData)
window.WebpackData = inflateData(window.WebpackData)

const { WebpackData } = window

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer])

const { Title, Text } = Typography
const { Sider, Content } = Layout
const { Group: CheckboxGroup } = Checkbox
const { Group: RadioGroup } = Radio

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

const getFileSize = size => {
  return filesize(size || 0, { base: 2, standard: 'jedec' })
}

const chunksList = map(assets, 'name')

const sleep = time => {
  return new Promise(resolve => setTimeout(resolve, time * 1e3))
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

const renderChart = (chartRef, { checkedChunks }) => {
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
      formatter: function (info) {
        const { value, treePathInfo, data } = info
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
        // left: 'center',
        width: '100%',
        height: '100%',
        label: {
          padding: 0
          // align: 'center',
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

const App = () => {
  const resizableRef = useRef()

  const chartRef = useRef()

  const [collapsed, setCollapsed] = useState(JSON.parse(window.localStorage.getItem(CollapsedKey)))
  const [siderWidth, setSiderWidth] = useState(JSON.parse(window.localStorage.getItem(SiderWidthKey)) || 400)

  const [checkedChunks, setCheckedChunks] = useState(chunksList)
  const [indeterminate, setIndeterminate] = useState(false)
  const [checkAll, setCheckAll] = useState(true)

  const onCheckedChange = list => {
    setCheckedChunks(list)
    setIndeterminate(!!list.length && list.length < chunksList.length)
    setCheckAll(list.length === chunksList.length)
    renderChart(chartRef, {
      checkedChunks: list
    })
  }

  const onCheckAllChange = e => {
    const { checked } = e.target
    setCheckedChunks(checked ? [...chunksList] : [])
    setIndeterminate(false)
    setCheckAll(checked)
    renderChart(chartRef, {
      checkedChunks: checked ? chunksList : []
    })
  }

  useEffect(() => {
    renderChart(chartRef, {
      checkedChunks
    })
  }, [chartRef])

  useEffect(() => {
    const myObserver = new ResizeObserver(entries => {
      echarts.getInstanceByDom(chartRef.current)?.resize()
    })
    myObserver.observe(chartRef.current)
  }, [chartRef])

  return (
    <Layout style={{ height: '100vh' }}>
      <Resizable
        ref={resizableRef}
        defaultSize={{ width: collapsed ? 0 : siderWidth }}
        onResizeStop={(event, direction, refToElement, delta) => {
          const width = siderWidth + delta.width
          setSiderWidth(width)
          window.localStorage.setItem(SiderWidthKey, width)
        }}
        minWidth={collapsed ? 0 : 300}
        maxWidth={1000}
        enable={{
          right: true,
          top: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false
        }}
      >
        <Sider
          theme="light"
          width="100%"
          collapsible
          collapsedWidth={0}
          collapsed={collapsed}
          onCollapse={collapsed => {
            setCollapsed(collapsed)
            resizableRef.current.updateSize({
              width: collapsed ? 0 : siderWidth
            })
            window.localStorage.setItem(CollapsedKey, collapsed)
          }}
        >
          <div style={{ height: '100vh', padding: 12, overflowY: 'auto' }}>
            <Title level={4}>Show chunks:</Title>
            <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
              <Text>All (</Text>
              <Text strong>{getFileSize(map(assets, 'statSize').reduce(add, 0))}</Text>
              <Text>)</Text>
              <Text italic> {chunksList.length}</Text>
            </Checkbox>
            <CheckboxGroup value={checkedChunks} onChange={onCheckedChange} style={{ display: 'block' }}>
              {sortBy(assets, 'statSize')
                .reverse()
                .map(v => {
                  const { name, statSize } = v
                  return (
                    <div key={name}>
                      <Checkbox value={name}>
                        <Text type={Object.values(assetsByChunkName).includes(name) ? 'success' : ''}>
                          {last(name.split('/'))}
                        </Text>
                        <Text> (</Text>
                        <Text strong>{getFileSize(statSize)}</Text>
                        <Text>)</Text>
                      </Checkbox>
                    </div>
                  )
                })}
            </CheckboxGroup>
          </div>
        </Sider>
      </Resizable>
      <Content>
        <div ref={chartRef} style={{ height: '100%' }} />
      </Content>
    </Layout>
  )
}

createRoot(document.querySelector('#app')).render(<App />)
