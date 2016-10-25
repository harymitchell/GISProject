var express = require('express');
var router = express.Router();
var idw = require ("../idw");
var InverseDistanceWeighting = new idw.InverseDistanceWeighting();
var path = require('path');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'GIS Data Project' });
});

/* POST interpolate. */
router.post('/interpolate', function(req, res, next) {
  console.log (req.body.k, req.body.p, req.body.t, req.body.n)
  try {
    InverseDistanceWeighting.interpolateFromData(req.body);
    res.status(200).json({ data: 'res' })
  } catch (e){
    console.log (e)
    res.status(500).json({ error: e })
  }
});

module.exports = router;
