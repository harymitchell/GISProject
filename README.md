# GIS Project

## IDW JavaScript

The idw.js file is the node.js implementation if the Inverse Distance Weighting algorithm.  
This is a node.js module that can be imported into any node project. We export the entire 
InverseDistanceWeighting object.

Require the module and create an InverseDistanceWeighting object:

* var idw = require ("../idw");
* var InverseDistanceWeighting = new idw.InverseDistanceWeighting();

The creation parameters are: timeDomain, delimeter, factorTimeForNeighbors
However, if none are provided, there are defaults: DAY, \t, true

You can interpolate from raw data or from file path:

* interpolateFromData
* interpolateFromFilePath

There are 3 implied data structures

Measurement ::=
 *  pm25
 *  year
 *  month
 *  day

Point ::=
 *  id
 *  x
 *  y
 *  measurements
 
Neighbor ::=
 *  id
 *  isTimeValid
 *  d
 
Issue for discussion: We calculte Neighbor attribute isTimeValid because it is relevant to know whether the range of measurements for
a given nearest neighbor contains the time value we want to measure.  I do not know if my implementation is just wrong, or if
this it is inherent in the algorithm, but for the interpolatedValue function (( ti2 - t / ti2 - ti1 )*wi1 + ( t - ti1 / ti2 - ti1 )*wi2;),
if t is not in between ti1 and ti2, then the result is a negative number, which I think skews the results.  So it is better to choose
neighbors that are close in distance but also which have relevant time intervals measured. 

The implementation is currnetly unfinished.  The handleData function simply runs a few tests 
with single points. 

TODO:

* Must accept an input file of points to interpolate.  
* Must accept an output file name and write the results to file.
* Implement other timeDomains

## Express Web App

The app.js and other folders were genereated by the npm Express Generator plugin. The root resource is the index.jade file.  
The routes are defined in routes/index.js.  The post('/interpolate) route is the only functionality presently.

TODO:
* Pass data, k, and p args appropraitely to the IDW module

### Web Interface

This is very basic.  Currnetly using Jade templates, which should suffice given the simplicity of the interface.  

TODO:
* Add forms inputs for p and k and pass these to the server.
* Visualize the data with a JQuery Map: https://jqvmap.com is an easy JS mapping library I've worked with before.

### Run Book

  1. Download the code
  2. Download Node JS
  3. run npm install
  4. run npm start
  5. browse to localhost:3000
