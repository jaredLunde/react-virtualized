const env = process.env.NODE_ENV;

if (env === 'es') {
  module.exports = {
    ignore: [
      '*.jest.js',
      '*.e2e.js',
      '*.ssr.js',
      '*.example.js',
      'source/demo',
      'source/jest-*.js',
      'source/TestUtils.js',
    ],
    plugins: [
      ['flow-react-proptypes', {deadCode: true, useESModules: true}],
    ],
    presets: [
      [
        "@stellar-apps/es",
        {
          "env": {
            "useBuiltIns": false,
            "modules": false,
            "targets": {"browsers": ">5% in US"}
          },
          "runtime": {"useESModules": true}
        }
      ],
      "@stellar-apps/react",
      "@babel/flow"
    ]
  }
}