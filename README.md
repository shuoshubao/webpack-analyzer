# Install

```sh
npm i -D webpack-analyzer-plugin
```

# Usage

```js
const WebpackAnalyzerPlugin = require('webpack-analyzer-plugin')

module.exports = {
  plugins: [new WebpackAnalyzerPlugin()]
}
```

# Examples

- https://shuoshubao.github.io/webpack-analyzer

# Options

| Name     | Type   | Default              | Description                                                                                                                                                 |
| -------- | ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| filename | String | WebpackAnalyzer.html | Path to bundle report file<br />It can be either an absolute path or a path relative to a bundle output directory (which is output.path in webpack config). |
