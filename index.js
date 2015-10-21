// Heavily inspired by Mike Bostock's d3 voronoi
// https://github.com/d3/d3-voronoi
// https://en.wikipedia.org/wiki/Voronoi_diagram
// https://en.wikipedia.org/wiki/Fortune%27s_algorithm

var polygon = require('turf-polygon');
var featurecollection = require('turf-featurecollection');


/**
 * Under Development - Not ready for use!
 * Takes a set of {@link Point|points} and
 * creates [Voronoi Polygons](https://en.wikipedia.org/wiki/Voronoi_diagram),
 * returned as a collection of Polygons. These are often used
 * for partitioning in to regions called Voronoi cells.
 *
 * @module turf/voronoi
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

  //***********************
  //
  //      Beaches
  //
  // **********************

  var beachPool = [];

  function Beach() {
    RedBlackNode(this);
    this.edge =
      this.site =
      this.circle = null;
  }

  function createBeach(site) {
    var beach = beachPool.pop() || new Beach();
    beach.site = site;
    return beach;
  }

  function detachBeach(beach) {
    detachCircle(beach);
    beaches.remove(beach);
    beachPool.push(beach);
    RedBlackNode(beach);
  }

  function removeBeach(beach) {
    var circle = beach.circle,
      x = circle.x,
      y = circle.cy,
      vertex = {
        x: x,
        y: y
      },
      previous = beach.P,
      next = beach.N,
      disappearing = [beach];

    detachBeach(beach);

    var lArc = previous;
    while (lArc.circle && Math.abs(x - lArc.circle.x) < epsilon &&
      Math.abs(y - lArc.circle.cy) < epsilon) {
      previous = lArc.P;
      disappearing.unshift(lArc);
      detachBeach(lArc);
      lArc = previous;
    }

    disappearing.unshift(lArc);
    detachCircle(lArc);

    var rArc = next;
    while (rArc.circle && Math.abs(x - rArc.circle.x) < epsilon &&
      Math.abs(y - rArc.circle.cy) < epsilon) {
      next = rArc.N;
      disappearing.push(rArc);
      detachBeach(rArc);
      rArc = next;
    }

    disappearing.push(rArc);
    detachCircle(rArc);

    var nArcs = disappearing.length,
      iArc;
    for (iArc = 1; iArc < nArcs; ++iArc) {
      rArc = disappearing[iArc];
      lArc = disappearing[iArc - 1];
      setEdgeEnd(rArc.edge, lArc.site, rArc.site, vertex);
    }

    lArc = disappearing[0];
    rArc = disappearing[nArcs - 1];
    rArc.edge = createEdge(lArc.site, rArc.site, null, vertex);

    attachCircle(lArc);
    attachCircle(rArc);
  }

  function addBeach(site) {
    var x = site.x,
      directrix = site.y,
      lArc,
      rArc,
      dxl,
      dxr,
      node = beaches._;

    while (node) {
      dxl = leftBreakPoint(node, directrix) - x;
      if (dxl > epsilon) node = node.L;
      else {
        dxr = x - rightBreakPoint(node, directrix);
        if (dxr > epsilon) {
          if (!node.R) {
            lArc = node;
            break;
          }
          node = node.R;
        } else {
          if (dxl > -epsilon) {
            lArc = node.P;
            rArc = node;
          } else if (dxr > -epsilon) {
            lArc = node;
            rArc = node.N;
          } else {
            lArc = rArc = node;
          }
          break;
        }
      }
    }

    createCell(site);
    var newArc = createBeach(site);
    beaches.insert(lArc, newArc);

    if (!lArc && !rArc) return;

    if (lArc === rArc) {
      detachCircle(lArc);
      rArc = createBeach(lArc.site);
      beaches.insert(newArc, rArc);
      newArc.edge = rArc.edge = createEdge(lArc.site, newArc.site);
      attachCircle(lArc);
      attachCircle(rArc);
      return;
    }

    if (!rArc) { // && lArc
      newArc.edge = createEdge(lArc.site, newArc.site);
      return;
    }

    // else lArc !== rArc
    detachCircle(lArc);
    detachCircle(rArc);

    var lSite = lArc.site,
      ax = lSite.x,
      ay = lSite.y,
      bx = site.x - ax,
      by = site.y - ay,
      rSite = rArc.site,
      cx = rSite.x - ax,
      cy = rSite.y - ay,
      d = 2 * (bx * cy - by * cx),
      hb = bx * bx + by * by,
      hc = cx * cx + cy * cy,
      vertex = {
        x: (cy * hb - by * hc) / d + ax,
        y: (bx * hc - cx * hb) / d + ay
      };

    setEdgeEnd(rArc.edge, lSite, rSite, vertex);
    newArc.edge = createEdge(lSite, site, null, vertex);
    rArc.edge = createEdge(site, rSite, null, vertex);
    attachCircle(lArc);
    attachCircle(rArc);
  }

  function leftBreakPoint(arc, directrix) {
    var site = arc.site,
      rfocx = site.x,
      rfocy = site.y,
      pby2 = rfocy - directrix;

    if (!pby2) return rfocx;

    var lArc = arc.P;
    if (!lArc) return -Infinity;

    site = lArc.site;
    var lfocx = site.x,
      lfocy = site.y,
      plby2 = lfocy - directrix;

    if (!plby2) return lfocx;

    var hl = lfocx - rfocx,
      aby2 = 1 / pby2 - 1 / plby2,
      b = hl / plby2;

    if (aby2) return (-b + Math.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;

    return (rfocx + lfocx) / 2;
  }

  function rightBreakPoint(arc, directrix) {
    var rArc = arc.N;
    if (rArc) return leftBreakPoint(rArc, directrix);
    var site = arc.site;
    return site.y === directrix ? site.x : Infinity;
  }

  //***********************
  //
  //        Cells
  //
  // **********************

  function  Cell(site) {
    this.site = site;
    this.edges = [];
  }

  Cell.prototype.prepare = function() {
    var halfEdges = this.edges,
      iHalfEdge = halfEdges.length,
      edge;

    while (iHalfEdge--) {
      edge = halfEdges[iHalfEdge].edge;
      if (!edge.b || !edge.a) halfEdges.splice(iHalfEdge, 1);
    }

    halfEdges.sort(descendingAngle);
    return halfEdges.length;
  };

  function createCell(site) {
    cells[site.i] = new Cell(site);
    return cells[site.i];
  }

  function closeCells(x0, y0, x1, y1) {
    var x2,
      y2,
      x3,
      y3,
      iCell = cells.length,
      cell,
      iHalfEdge,
      halfEdges,
      nHalfEdges,
      start,
      end;

    while (iCell--) {
      cell = cells[iCell];
      if (!cell || !cell.prepare()) continue;
      halfEdges = cell.edges;
      nHalfEdges = halfEdges.length;
      iHalfEdge = 0;
      while (iHalfEdge < nHalfEdges) {
        end = halfEdges[iHalfEdge].end();
        x3 = end.x;
        y3 = end.y;
        start = halfEdges[++iHalfEdge % nHalfEdges].start();
        x2 = start.x;
        y2 = start.y;
        if (Math.abs(x3 - x2) > epsilon || Math.abs(y3 - y2) > epsilon) {
          halfEdges.splice(iHalfEdge, 0, createHalfEdge(createBorderEdge(cell.site, end,
            Math.abs(x3 - x0) < epsilon && y1 - y3 > epsilon ? {
              x: x0,
              y: Math.abs(x2 - x0) < epsilon ? y2 : y1
            } : Math.abs(y3 - y1) < epsilon && x1 - x3 > epsilon ? {
              x: Math.abs(y2 - y1) < epsilon ? x2 : x1,
              y: y1
            } : Math.abs(x3 - x1) < epsilon && y3 - y0 > epsilon ? {
              x: x1,
              y: Math.abs(x2 - x1) < epsilon ? y2 : y0
            } : Math.abs(y3 - y0) < epsilon && x3 - x0 > epsilon ? {
              x: Math.abs(y2 - y0) < epsilon ? x2 : x0,
              y: y0
            } : null), cell.site, null));
          ++nHalfEdges;
        }
      }
    }
  }

  //***********************
  //
  //        Circles
  //
  // **********************

  var circlePool = [];
  var firstCircle;

  function Circle() {
    RedBlackNode(this);
    this.x =
      this.y =
      this.arc =
      this.site =
      this.cy = null;
  }

  function attachCircle(arc) {
    var lArc = arc.P,
      rArc = arc.N;

    if (!lArc || !rArc) return;

    var lSite = lArc.site,
      cSite = arc.site,
      rSite = rArc.site;

    if (lSite === rSite) return;

    var bx = cSite.x,
      by = cSite.y,
      ax = lSite.x - bx,
      ay = lSite.y - by,
      cx = rSite.x - bx,
      cy = rSite.y - by;

    var d = 2 * (ax * cy - ay * cx);
    if (d >= -epsilon2) return;

      ha = ax * ax + ay * ay;
      hc = cx * cx + cy * cy;
      x = (cy * ha - ay * hc) / d;
      y = (ax * hc - cx * ha) / d;
      cy = y + by;

    var circle = circlePool.pop() || new Circle();
    circle.arc = arc;
    circle.site = cSite;
    circle.x = x + bx;
    circle.y = cy + Math.sqrt(x * x + y * y); // y bottom
    circle.cy = cy;

    arc.circle = circle;

    var before = null,
      node = circles._;

    while (node) {
      if (circle.y < node.y || (circle.y === node.y && circle.x <= node.x)) {
        if (node.L) node = node.L;
        else {
          before = node.P;
          break;
        }
      } else {
        if (node.R) node = node.R;
        else {
          before = node;
          break;
        }
      }
    }

    circles.insert(before, circle);
    if (!before) firstCircle = circle;
  }

  function detachCircle(arc) {
    var circle = arc.circle;
    if (circle) {
      if (!circle.P) firstCircle = circle.N;
      circles.remove(circle);
      circlePool.push(circle);
      RedBlackNode(circle);
      arc.circle = null;
    }
  }

  //***********************
  //
  //        Edges
  //
  // **********************

  function Edge(lSite, rSite) {
    this.l = lSite;
    this.r = rSite;
    this.a = this.b = null; // for border edges
  }

  function createEdge(lSite, rSite, va, vb) {
    var edge = new Edge(lSite, rSite);
    edges.push(edge);
    if (va) setEdgeEnd(edge, lSite, rSite, va);
    if (vb) setEdgeEnd(edge, rSite, lSite, vb);
    cells[lSite.i].edges.push(createHalfEdge(edge, lSite, rSite));
    cells[rSite.i].edges.push(createHalfEdge(edge, rSite, lSite));
    return edge;
  }

  function createBorderEdge(lSite, va, vb) {
    var edge = new Edge(lSite, null);
    edge.a = va;
    edge.b = vb;
    edges.push(edge);
    return edge;
  }

  function setEdgeEnd(edge, lSite, rSite, vertex) {
    if (!edge.a && !edge.b) {
      edge.a = vertex;
      edge.l = lSite;
      edge.r = rSite;
    } else if (edge.l === rSite) {
      edge.b = vertex;
    } else {
      edge.a = vertex;
    }
  }

  // Liang–Barsky line clipping.
  function clipLine(line, x0, y0, x1, y1) {
    var a = line.a,
      b = line.b,
      ax = a.x,
      ay = a.y,
      bx = b.x,
      by = b.y,
      t0 = 0,
      t1 = 1,
      dx = bx - ax,
      dy = by - ay,
      r;

    r = x0 - ax;
    if (!dx && r > 0) return;
    r /= dx;
    if (dx < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dx > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = x1 - ax;
    if (!dx && r < 0) return;
    r /= dx;
    if (dx < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dx > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    r = y0 - ay;
    if (!dy && r > 0) return;
    r /= dy;
    if (dy < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dy > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = y1 - ay;
    if (!dy && r < 0) return;
    r /= dy;
    if (dy < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dy > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    if (t0 > 0) line.a = {
      x: ax + t0 * dx,
      y: ay + t0 * dy
    };
    if (t1 < 1) line.b = {
      x: ax + t1 * dx,
      y: ay + t1 * dy
    };
    return line;
  }

  function connectEdge(edge, x0, y0, x1, y1) {
    var vb = edge.b;
    if (vb) return true;

    var va = edge.a,
      lSite = edge.l,
      rSite = edge.r,
      lx = lSite.x,
      ly = lSite.y,
      rx = rSite.x,
      ry = rSite.y,
      fx = (lx + rx) / 2,
      fy = (ly + ry) / 2,
      fm,
      fb;

    if (ry === ly) {
      if (fx < x0 || fx >= x1) return;
      if (lx > rx) {
        if (!va) va = {
          x: fx,
          y: y0
        };
        else if (va.y >= y1) return;
        vb = {
          x: fx,
          y: y1
        };
      } else {
        if (!va) va = {
          x: fx,
          y: y1
        };
        else if (va.y < y0) return;
        vb = {
          x: fx,
          y: y0
        };
      }
    } else {
      fm = (lx - rx) / (ry - ly);
      fb = fy - fm * fx;
      if (fm < -1 || fm > 1) {
        if (lx > rx) {
          if (!va) va = {
            x: (y0 - fb) / fm,
            y: y0
          };
          else if (va.y >= y1) return;
          vb = {
            x: (y1 - fb) / fm,
            y: y1
          };
        } else {
          if (!va) va = {
            x: (y1 - fb) / fm,
            y: y1
          };
          else if (va.y < y0) return;
          vb = {
            x: (y0 - fb) / fm,
            y: y0
          };
        }
      } else {
        if (ly < ry) {
          if (!va) va = {
            x: x0,
            y: fm * x0 + fb
          };
          else if (va.x >= x1) return;
          vb = {
            x: x1,
            y: fm * x1 + fb
          };
        } else {
          if (!va) va = {
            x: x1,
            y: fm * x1 + fb
          };
          else if (va.x < x0) return;
          vb = {
            x: x0,
            y: fm * x0 + fb
          };
        }
      }
    }

    edge.a = va;
    edge.b = vb;
    return true;
  }

  function clipEdges(x0, y0, x1, y1) {
    var i = edges.length,
      e;
    while (i--) {
      e = edges[i];
      if (!connectEdge(e, x0, y0, x1, y1) || !clipLine(e, x0, y0, x1, y1) || (Math.abs(e.a.x - e.b.x) < epsilon && Math.abs(e.a.y - e.b.y) < epsilon)) {
        e.a = e.b = null;
        edges.splice(i, 1);
      }
    }
  }

  //***********************
  //
  //       Half Edges
  //
  // **********************

  function HalfEdge(edge, site, angle) {
    this.edge = edge;
    this.site = site;
    this.angle = angle;
  }

  HalfEdge.prototype = {
    start: function() {
      return this.edge.l === this.site ? this.edge.a : this.edge.b;
    },
    end: function() {
      return this.edge.l === this.site ? this.edge.b : this.edge.a;
    }
  };

  function createHalfEdge(edge, lSite, rSite) {
    var va = edge.a,
      vb = edge.b;
    return new HalfEdge(edge, lSite, rSite ? Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x) : edge.l === lSite ? Math.atan2(vb.x - va.x, va.y - vb.y) : Math.atan2(va.x - vb.x, vb.y - va.y));
  }

  function descendingAngle(a, b) {
    return b.angle - a.angle;
  }

  //***********************
  //
  //     Red Black Tree
  //
  // **********************

  function RedBlackTree() {
    this._ = null; // root node
  }

  function RedBlackNode(node) {
    node.U = // parent node
      node.C = // color - true for red, false for black
      node.L = // left node
      node.R = // right node
      node.P = // previous node
      node.N = null; // next node
  }

  RedBlackTree.prototype = {

    insert: function(after, node) {
      var parent, grandpa, uncle;

      if (after) {
        node.P = after;
        node.N = after.N;
        if (after.N) after.N.P = node;
        after.N = node;
        if (after.R) {
          after = after.R;
          while (after.L) after = after.L;
          after.L = node;
        } else {
          after.R = node;
        }
        parent = after;
      } else if (this._) {
        after = RedBlackFirst(this._);
        node.P = null;
        node.N = after;
        after.P = after.L = node;
        parent = after;
      } else {
        node.P = node.N = null;
        this._ = node;
        parent = null;
      }
      node.L = node.R = null;
      node.U = parent;
      node.C = true;

      after = node;
      while (parent && parent.C) {
        grandpa = parent.U;
        if (parent === grandpa.L) {
          uncle = grandpa.R;
          if (uncle && uncle.C) {
            parent.C = uncle.C = false;
            grandpa.C = true;
            after = grandpa;
          } else {
            if (after === parent.R) {
              RedBlackRotateLeft(this, parent);
              after = parent;
              parent = after.U;
            }
            parent.C = false;
            grandpa.C = true;
            RedBlackRotateRight(this, grandpa);
          }
        } else {
          uncle = grandpa.L;
          if (uncle && uncle.C) {
            parent.C = uncle.C = false;
            grandpa.C = true;
            after = grandpa;
          } else {
            if (after === parent.L) {
              RedBlackRotateRight(this, parent);
              after = parent;
              parent = after.U;
            }
            parent.C = false;
            grandpa.C = true;
            RedBlackRotateLeft(this, grandpa);
          }
        }
        parent = after.U;
      }
      this._.C = false;
    },

    remove: function(node) {
      if (node.N) node.N.P = node.P;
      if (node.P) node.P.N = node.N;
      node.N = node.P = null;

      var parent = node.U,
        sibling,
        left = node.L,
        right = node.R,
        next,
        red;

      if (!left) next = right;
      else if (!right) next = left;
      else next = RedBlackFirst(right);

      if (parent) {
        if (parent.L === node) parent.L = next;
        else parent.R = next;
      } else {
        this._ = next;
      }

      if (left && right) {
        red = next.C;
        next.C = node.C;
        next.L = left;
        left.U = next;
        if (next !== right) {
          parent = next.U;
          next.U = node.U;
          node = next.R;
          parent.L = node;
          next.R = right;
          right.U = next;
        } else {
          next.U = parent;
          parent = next;
          node = next.R;
        }
      } else {
        red = node.C;
        node = next;
      }

      if (node) node.U = parent;
      if (red) return;
      if (node && node.C) {
        node.C = false;
        return;
      }

      do {
        if (node === this._) break;
        if (node === parent.L) {
          sibling = parent.R;
          if (sibling.C) {
            sibling.C = false;
            parent.C = true;
            RedBlackRotateLeft(this, parent);
            sibling = parent.R;
          }
          if ((sibling.L && sibling.L.C) || (sibling.R && sibling.R.C)) {
            if (!sibling.R || !sibling.R.C) {
              sibling.L.C = false;
              sibling.C = true;
              RedBlackRotateRight(this, sibling);
              sibling = parent.R;
            }
            sibling.C = parent.C;
            parent.C = sibling.R.C = false;
            RedBlackRotateLeft(this, parent);
            node = this._;
            break;
          }
        } else {
          sibling = parent.L;
          if (sibling.C) {
            sibling.C = false;
            parent.C = true;
            RedBlackRotateRight(this, parent);
            sibling = parent.L;
          }
          if ((sibling.L && sibling.L.C) || (sibling.R && sibling.R.C)) {
            if (!sibling.L || !sibling.L.C) {
              sibling.R.C = false;
              sibling.C = true;
              RedBlackRotateLeft(this, sibling);
              sibling = parent.L;
            }
            sibling.C = parent.C;
            parent.C = sibling.L.C = false;
            RedBlackRotateRight(this, parent);
            node = this._;
            break;
          }
        }
        sibling.C = true;
        node = parent;
        parent = parent.U;
      } while (!node.C);

      if (node) node.C = false;
    }

  };

  function RedBlackRotateLeft(tree, node) {
    var p = node,
      q = node.R,
      parent = p.U;

    if (parent) {
      if (parent.L === p) parent.L = q;
      else parent.R = q;
    } else {
      tree._ = q;
    }

    q.U = parent;
    p.U = q;
    p.R = q.L;
    if (p.R) p.R.U = p;
    q.L = p;
  }

  function RedBlackRotateRight(tree, node) {
    var p = node,
      q = node.L,
      parent = p.U;

    if (parent) {
      if (parent.L === p) parent.L = q;
      else parent.R = q;
    } else {
      tree._ = q;
    }

    q.U = parent;
    p.U = q;
    p.L = q.R;
    if (p.L) p.L.U = p;
    q.R = p;
  }

  function RedBlackFirst(node) {
    while (node.L) node = node.L;
    return node;
  }

  //***********************
  //
  //       Voronoi
  //
  // **********************

  var nullExtent = [
    [-1e6, -1e6],
    [1e6, 1e6]
  ];
  var epsilon = 1e-6;
  var epsilon2 = 1e-12;
  var beaches;
  var cells;
  var circles;
  var edges;

  function pointX(p) {
    return p[0];
  }

  function pointY(p) {
    return p[1];
  }

  function functor(x) {
    return function() {
      return x;
    };
  }

  function triangleArea(a, b, c) {
    return (a.x - c.x) * (b.y - a.y) - (a.x - b.x) * (c.y - a.y);
  }

  function lexicographic(a, b) {
    return b.y - a.y || b.x - a.x;
  }

  function computeVoronoi(sites, extent) {
    var site = sites.sort(lexicographic).pop(),
      x0,
      y0,
      circle;

    edges = [];
    cells = new Array(sites.length);
    beaches = new RedBlackTree();
    circles = new RedBlackTree();

    while (true) {
      circle = firstCircle;
      if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
        if (site.x !== x0 || site.y !== y0) {
          addBeach(site);
          x0 = site.x;
          y0 = site.y;
        }
        site = sites.pop();
      } else if (circle) {
        removeBeach(circle.arc);
      } else {
        break;
      }
    }

    if (extent) {
        x0 = extent[0][0];
        y0 = extent[0][1];
        x1 = extent[1][0];
        y1 = extent[1][1];
      clipEdges(x0, y0, x1, y1);
      closeCells(x0, y0, x1, y1);
    }

    var diagram = {
      cells: cells,
      edges: edges
    };
    beaches = circles = edges = cells = null;
    return diagram;
  }

  return function () {
    var x = pointX,
      y = pointY,
      fx = x,
      fy = y,
      extent = nullExtent;

    function voronoi(data) {
      var polygons = new Array(data.length),
        x0 = extent[0][0];
        y0 = extent[0][1];
        x1 = extent[1][0];
        y1 = extent[1][1];

      computeVoronoi(points(data), extent).cells.forEach(function(cell, i) {
        var edges = cell.edges,
          site = cell.site,
          polygon = polygons[i] = edges.length ? edges.map(function(e) {
            var s = e.start();
            return [s.x, s.y];
          }) : site.x >= x0 && site.x <= x1 && site.y >= y0 && site.y <= y1 ? [
            [x0, y1],
            [x1, y1],
            [x1, y0],
            [x0, y0]
          ] : [];
        polygon.point = data[i];
      });

      return polygons;
    }

    function points(data) {
      return data.map(function(d, i) {
        return {
          x: Math.round(fx(d, i) / epsilon) * epsilon,
          y: Math.round(fy(d, i) / epsilon) * epsilon,
          i: i
        };
      });
    }

    voronoi.links = function(data) {
      return computeVoronoi(points(data)).edges.filter(function(edge) {
        return edge.l && edge.r;
      }).map(function(edge) {
        return {
          source: data[edge.l.i],
          target: data[edge.r.i]
        };
      });
    };

    voronoi.triangles = function(data) {
      var triangles = [];

      computeVoronoi(points(data)).cells.forEach(function(cell, i) {
        var site = cell.site,
          edges = cell.edges.sort(descendingAngle),
          j = -1,
          m = edges.length,
          e0,
          s0,
          e1 = edges[m - 1].edge,
          s1 = e1.l === site ? e1.r : e1.l;

        while (++j < m) {
          e0 = e1;
          s0 = s1;
          e1 = edges[j].edge;
          s1 = e1.l === site ? e1.r : e1.l;
          if (i < s0.i && i < s1.i && triangleArea(site, s0, s1) < 0) {
            triangles.push([data[i], data[s0.i], data[s1.i]]);
          }
        }
      });

      return triangles;
    };

    voronoi.x = function(_) {
      return arguments.length ? (x = _, fx = typeof _ === "function" ? x : functor(x), voronoi) : x;
    };

    voronoi.y = function(_) {
      return arguments.length ? (y = _, fy = typeof _ === "function" ? y : functor(y), voronoi) : y;
    };

    voronoi.extent = function(_) {
      if (!arguments.length) return extent === nullExtent ? null : extent;
      extent = _ === null || _ === undefined ? nullExtent : _;
      return voronoi;
    };

    voronoi.size = function(_) {
      if (!arguments.length) return extent === nullExtent ? null : extent && extent[1];
      return voronoi.extent(_ && [
        [0, 0], _
      ]);
    };

    return voronoi;
  }
};
