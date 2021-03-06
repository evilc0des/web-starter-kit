/**
 *
 *  Web Starter Kit
 *  Copyright 2015 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */

'use strict';

// This gulpfile makes use of new JavaScript features.
// Babel handles this without us having to do anything. It just works.
// You can read more about the new JavaScript features here:
// https://babeljs.io/docs/learn-es2015/

import path from 'path';
import {
	src,
	dest,
	series,
	parallel,
	watch
} from 'gulp';
import del from 'del';
import browserSync from 'browser-sync';
import {
	generateSW
} from 'workbox-build';
import gulpLoadPlugins from 'gulp-load-plugins';
import {
	output as pagespeed
} from 'psi';
import pkg from './package.json';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

// Lint JavaScript
function lint() {
	return src(['app/scripts/**/*.js', '!node_modules/**'])
		.pipe($.eslint())
		.pipe($.eslint.format())
		.pipe($.if(!browserSync.active, $.eslint.failAfterError()))
}

// Optimize images
function images() {
	return src('app/images/**/*')
		.pipe($.cache($.imagemin({
			progressive: true,
			interlaced: true
		})))
		.pipe(dest('dist/images'))
		.pipe($.size({
			title: 'images'
		}));
}


// Copy all files at the root level (app)
function copy() {
	return src([
			'app/*',
			'!app/*.html',
			'node_modules/apache-server-configs/dist/.htaccess'
		], {
			dot: true
		}).pipe(dest('dist'))
		.pipe($.size({
			title: 'copy'
		}))
}

// Compile and automatically prefix stylesheets
function styles() {
	const AUTOPREFIXER_BROWSERS = [
		'ie >= 10',
		'ie_mob >= 10',
		'ff >= 30',
		'chrome >= 34',
		'safari >= 7',
		'opera >= 23',
		'ios >= 7',
		'android >= 4.4',
		'bb >= 10'
	];

	// For best performance, don't add Sass partials to `gulp.src`
	return src([
			'app/styles/**/*.scss',
			'app/styles/**/*.css'
		])
		.pipe($.newer('.tmp/styles'))
		.pipe($.sourcemaps.init())
		.pipe($.sass({
			precision: 10
		}).on('error', $.sass.logError))
		.pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
		.pipe(dest('.tmp/styles'))
		// Concatenate and minify styles
		.pipe($.if('*.css', $.cssnano()))
		.pipe($.size({
			title: 'styles'
		}))
		.pipe($.sourcemaps.write('./'))
		.pipe(dest('dist/styles'))
		.pipe(dest('.tmp/styles'));
}

// Concatenate and minify JavaScript. Optionally transpiles ES2015 code to ES5.
// to enable ES2015 support remove the line `"only": "gulpfile.babel.js",` in the
// `.babelrc` file.
function scripts() {
	return src([
			// Note: Since we are not using useref in the scripts build pipeline,
			//       you need to explicitly list your scripts here in the right order
			//       to be correctly concatenated
			'./app/scripts/main.js'
			// Other scripts
		])
		.pipe($.newer('.tmp/scripts'))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write())
		.pipe(dest('.tmp/scripts'))
		.pipe($.concat('main.min.js'))
		.pipe($.uglify({
			preserveComments: 'some'
		}))
		// Output files
		.pipe($.size({
			title: 'scripts'
		}))
		.pipe($.sourcemaps.write('.'))
		.pipe(dest('dist/scripts'))
		.pipe(dest('.tmp/scripts'));
}

// Scan your HTML for assets & optimize them
function html() {
	return src('app/**/*.html')
		.pipe($.useref({
			searchPath: '{.tmp,app}',
			noAssets: true
		}))

		// Minify any HTML
		.pipe($.if('*.html', $.htmlmin({
			removeComments: true,
			collapseWhitespace: true,
			collapseBooleanAttributes: true,
			removeAttributeQuotes: true,
			removeRedundantAttributes: true,
			removeEmptyAttributes: true,
			removeScriptTypeAttributes: true,
			removeStyleLinkTypeAttributes: true,
			removeOptionalTags: true
		})))
		// Output files
		.pipe($.if('*.html', $.size({
			title: 'html',
			showFiles: true
		})))
		.pipe(dest('dist'));
}

// Clean output directory
function clean() {
	return del(['.tmp', 'dist/*', '!dist/.git'], {
		dot: true
	});
}

// Watch files for changes & reload
const serve = series(parallel(scripts, styles), () => {
	browserSync({
		notify: false,
		// Customize the Browsersync console logging prefix
		logPrefix: 'WSK',
		// Allow scroll syncing across breakpoints
		scrollElementMapping: ['main', '.mdl-layout'],
		// Run as an https by uncommenting 'https: true'
		// Note: this uses an unsigned certificate which on first access
		//       will present a certificate warning in the browser.
		// https: true,
		server: ['.tmp', 'app'],
		port: 3000
	});

	watch(['app/**/*.html'], reload);
	watch(['app/styles/**/*.{scss,css}'], series(styles, reload));
	watch(['app/scripts/**/*.js'], series(lint, scripts, reload));
	watch(['app/images/**/*'], reload);
});

// Build production files, the default task
const defaultTask = series(clean,
	styles,
	parallel(lint, html, scripts, images, copy),
	serviceWorkerTask,
	cb => {
		cb();
	}
);

// Build and serve the output from the dist build
const serveDist = series(defaultTask, () =>
	browserSync({
		notify: false,
		logPrefix: 'WSK',
		// Allow scroll syncing across breakpoints
		scrollElementMapping: ['main', '.mdl-layout'],
		// Run as an https by uncommenting 'https: true'
		// Note: this uses an unsigned certificate which on first access
		//       will present a certificate warning in the browser.
		// https: true,
		server: 'dist',
		port: 3001
	})
)

// Run PageSpeed Insights
function pagespeed(cb) {
	pagespeed('example.com', {
		strategy: 'mobile'
		// By default we use the PageSpeed Insights free (no API key) tier.
		// Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
		// key: 'YOUR_API_KEY'
	}, cb);
}

// See http://www.html5rocks.com/en/tutorials/service-worker/introduction/ for
// an in-depth explanation of what service workers are and why you should care.
// Generate a service worker file that will provide offline functionality for
// local resources. This should only be done for the 'dist' directory, to allow
// live reload to work as expected when serving from the 'app' directory

function serviceWorkerTask() {
	const rootDir = 'dist';
	const filepath = path.join(rootDir, 'service-worker.js');

	return generateSW({
		swDest: filepath,
		// Used to avoid cache conflicts when serving on localhost.
		cacheId: pkg.name || 'web-starter-kit',
		// sw-toolbox.js needs to be listed first. It sets up methods used in runtime-caching.js.
		globPatterns: [
			// Add/remove glob patterns to match your directory setup.
			`${rootDir}/images/**/*`,
			`${rootDir}/scripts/**/*.js`,
			`${rootDir}/styles/**/*.css`,
			`${rootDir}/*.{html,json}`
		],
		// Translates a static file path to the relative URL that it's served from.
		// This is '/' rather than path.sep because the paths returned from
		// glob always use '/'.
		globDirectory: rootDir + '/',
		runtimeCaching: [{
			// You can use a RegExp as the pattern:
			urlPattern: /\.(?:googleapis|gstatic)\.com$/,
			handler: 'staleWhileRevalidate',
		}]
	});
}

// Load custom tasks from the `tasks` directory
// Run: `npm install --save-dev require-dir` from the command-line
// try { require('require-dir')('tasks'); } catch (err) { console.error(err); }

module.exports =  {
	serve,
	'serve:dist' : serveDist,
	default: defaultTask
}