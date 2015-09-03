# turf-voronoi

[![build status](https://secure.travis-ci.org/Turfjs/turf-voronoi.png)](http://travis-ci.org/Turfjs/turf-voronoi)

turf voronoi module


### `turf-voronoi(points)`

Takes a set of Point|points and
creates [Voronoi Polygons](https://en.wikipedia.org/wiki/Voronoi_diagram),
returned as a collection of Polygons. These are often used
for partitioning in to regions called Voronoi cells.

### Parameters

| parameter | type                         | description  |
| --------- | ---------------------------- | ------------ |
| `points`  | FeatureCollection\.\<Point\> | input points |


### Example

```js
// generate some random point data
var points = turf.random('points', 30, {
  bbox: [50, 30, 70, 50]
});
var voronoi = turf.voronoi(points);
//=voronoi
```


**Returns** `FeatureCollection.<Polygon>`, Voronoi output

## Installation

Requires [nodejs](http://nodejs.org/).

```sh
$ npm install turf-voronoi
```

## Tests

```sh
$ npm test
```


