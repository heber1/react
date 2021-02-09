/* eslint-disable global-require */
import express from 'express';
import dotenv from 'dotenv';
import webpack from 'webpack';
import helmet from 'helmet';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderRoutes } from 'react-router-config';
import { StaticRouter } from 'react-router-dom';
import serverRoutes from '../frontend/routes/serverRoutes';
import reducer from '../frontend/reducers';
import initialState from '../frontend/initialState';
import getManifest from './getManifest';

dotenv.config();

const { ENV, PORT } = process.env;
const app = express();

if (ENV === 'development') {
  console.log('development config');
  const webpackConfig = require('../../webpack.config');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const compiler = webpack(webpackConfig);
  const { publicPath } = webpackConfig.output;
  const serverConfig = { serverSideRender: true, publicPath };
  //const serverConfig = { port: PORT, hot: true };

  app.use(webpackDevMiddleware(compiler, serverConfig));
  app.use(webpackHotMiddleware(compiler));
} else {
  app.use((req, res, next) => {
    if (!req.hashManifest) req.hashManifest = getManifest();
    next();
  });
  app.use(express.static(`${__dirname}/public`));
  //app.use(helmet());
  /* app.use(
    helmet.contentSecurityPolicy({
      directives: {
        'default-src': ["'self'"],
        //'script-src': ["'self'", "'sha256-lKtLIbt/r08geDBLpzup7D3pTCavi4hfYSO45z98900='"],
        'img-src': ["'self'", 'http://dummyimage.com'],
        'style-src-elem': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ['https://fonts.gstatic.com'],
        //'media-src': ['*'],
      },
    }),
  ); */
  //app.use(helmet.permittedCrossDomainPolicies());
  /*  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  ); */
  app.use(helmet.dnsPrefetchControl());
  app.use(helmet.expectCt());
  app.use(helmet.frameguard());
  app.use(helmet.hidePoweredBy());
  app.use(helmet.hsts());
  app.use(helmet.ieNoOpen());
  app.use(helmet.noSniff());
  app.use(helmet.permittedCrossDomainPolicies());
  app.use(helmet.referrerPolicy());
  app.use(helmet.xssFilter());

  app.disable('x-powered-by');
}

const setResponse = (html, preloadedState, manifest) => {
  const mainStyles = manifest ? manifest['main.css'] : 'assets/app.css';
  const mainBuild = manifest ? manifest['main.js'] : 'assets/app.js';
  //const vendorBuild = manifest ? manifest['vendors.js'] : 'assets/vendor.js';
  return (`
    <!DOCTYPE html> 
      <html>
        <head>
           <link rel="stylesheet" href="${mainStyles}" type="text/css">
           <title>PlatziVideo</title>
        </head>
        <body>
           <div id = "app">${html}</div>
           <script>
             window.__PRELOADED_STATE__ = ${JSON.stringify(preloadedState).replace(/</g, '\\u003c')}
           </script>
           <script src="${mainBuild}" type="text/javascript"></script>
        </body>
      </html>
  `
  );
};

const renderApp = (req, res) => {
  const store = createStore(reducer, initialState);
  const preloadedState = store.getState();
  const html = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.url} context={{}}>
        {renderRoutes(serverRoutes)}
      </StaticRouter>
    </Provider>,
  );
  //res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' http://dummyimage.com; script-src 'self' 'sha256-T4gMAi7VL1GyW3+77Ol9xE1S/cFPb4d64iaMXBdt/vY='; style-src-elem 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com");
  res.send(setResponse(html, preloadedState, req.hashManifest));
};
app.get('*', renderApp);

app.listen(PORT, (err) => {
  if (err) console.log(err);
  else console.log(`Server running on port ${PORT}`);
});
