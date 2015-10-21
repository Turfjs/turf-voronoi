var test = require('tape');
var fs = require('fs');
var voronoi = require('../index.js');

test('voronoi', function(t){
  var points = JSON.parse(fs.readFileSync(__dirname+'/fixtures/points.geojson'));
  var voronoied = voronoi(points);

  t.equal(voronoied.features[0].geometry.type, 'Polygon');
  t.equal(voronoied.features.length, 17);

  fs.writeFileSync(__dirname+'/fixtures/voronoi.geojson', JSON.stringify(voronoied));
  t.end();
});
