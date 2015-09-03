// https://github.com/gorhill/Javascript-Voronoi
var polygon = require('turf-polygon');
var featurecollection = require('turf-featurecollection');

/**
 * Takes a set of {@link Point|points} and
 * creates [Voronoi Polygons](https://en.wikipedia.org/wiki/Voronoi_diagram),
 * returned as a collection of Polygons. These are often used
 * for partitioning in to regions called Voronoi cells.
 *
 * @module turf-voronoi
 * @category interpolation
 * @param {FeatureCollection<Point>} points input points
 * @return {FeatureCollection<Polygon>} Voronoi output
 * @example
 * // generate some random point data
 * var points = turf.random('points', 30, {
 *   bbox: [50, 30, 70, 50]
 * });
 * var voronoi = turf.voronoi(points);
 * //=voronoi
 */

module.exports = function(points) {

};
