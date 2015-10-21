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

    var leftArc = previous;
    while (leftArc.circle && Math.abs(x - leftArc.circle.x) < epsilon &&
      Math.abs(y - leftArc.circle.cy) < epsilon) {
      previous = leftArc.P;
      disappearing.unshift(leftArc);
      detachBeach(leftArc);
      leftArc = previous;
    }

    disappearing.unshift(leftArc);
    detachCircle(leftArc);

    var rightArc = next;
    while (rightArc.circle && Math.abs(x - rightArc.circle.x) < epsilon &&
      Math.abs(y - rightArc.circle.cy) < epsilon) {
      next = rightArc.N;
      disappearing.push(rightArc);
      detachBeach(rightArc);
      rightArc = next;
    }

    disappearing.push(rightArc);
    detachCircle(rightArc);

    var nArcs = disappearing.length,
      iArc;
    for (iArc = 1; iArc < nArcs; ++iArc) {
      rightArc = disappearing[iArc];
      leftArc = disappearing[iArc - 1];
      setEdgeEnd(rightArc.edge, leftArc.site, rightArc.site, vertex);
    }

    leftArc = disappearing[0];
    rightArc = disappearing[nArcs - 1];
    rightArc.edge = createEdge(leftArc.site, rightArc.site, null, vertex);

    attachCircle(leftArc);
    attachCircle(rightArc);
  }

  function addBeach(site) {
    var x = site.x,
      directrix = site.y,
      leftArc,
      rightArc,
      dxl,
      dxr,
      node = beaches._;

    while (node) {
      dxl = leftBreakPoint(node, directrix) - x;
      if (dxl > epsilon) node = node.Left;
      else {
        dxr = x - rightBreakPoint(node, directrix);
        if (dxr > epsilon) {
          if (!node.Right) {
            leftArc = node;
            break;
          }
          node = node.Right;
        } else {
          if (dxl > -epsilon) {
            leftArc = node.Previous;
            rightArc = node;
          } else if (dxr > -epsilon) {
            leftArc = node;
            rightArc = node.Next;
          } else {
            leftArc = rightArc = node;
          }
          break;
        }
      }
    }

    createCell(site);
    var newArc = createBeach(site);
    beaches.insert(leftArc, newArc);

    if (!leftArc && !rightArc) {
      return;
    }

    if (leftArc === rightArc) {
      detachCircle(leftArc);
      rightArc = createBeach(leftArc.site);
      beaches.insert(newArc, rightArc);
      newArc.edge = rightArc.edge = createEdge(leftArc.site, newArc.site);
      attachCircle(leftArc);
      attachCircle(rightArc);
      return;
    }

    if (!rightArc) { // && leftArc
      newArc.edge = createEdge(leftArc.site, newArc.site);
      return;
    }

    // else leftArc !== rightArc
    detachCircle(leftArc);
    detachCircle(rightArc);

    var leftSite = leftArc.site,
      ax = leftSite.x,
      ay = leftSite.y,
      bx = site.x - ax,
      by = site.y - ay,
      rightSite = rightArc.site,
      cx = rightSite.x - ax,
      cy = rightSite.y - ay,
      d = 2 * (bx * cy - by * cx),
      hb = bx * bx + by * by,
      hc = cx * cx + cy * cy,
      vertex = {
        x: (cy * hb - by * hc) / d + ax,
        y: (bx * hc - cx * hb) / d + ay
      };

    setEdgeEnd(rightArc.edge, leftSite, rightSite, vertex);
    newArc.edge = createEdge(leftSite, site, null, vertex);
    rightArc.edge = createEdge(site, rightSite, null, vertex);
    attachCircle(leftArc);
    attachCircle(rightArc);
  }

  function leftBreakPoint(arc, directrix) {
    var site = arc.site,
      rfocx = site.x,
      rfocy = site.y,
      pby2 = rfocy - directrix;

    if (!pby2) {
      return rfocx;
    }

    var leftArc = arc.P;
    if (!leftArc) {
      return -Infinity;
    }

    site = leftArc.site;
    var lfocx = site.x,
      lfocy = site.y,
      plby2 = lfocy - directrix;

    if (!plby2) {
      return lfocx;
    }

    var hl = lfocx - rfocx,
      aby2 = 1 / pby2 - 1 / plby2,
      b = hl / plby2;

    if (aby2) {
      return (-b + Math.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
    }

    return (rfocx + lfocx) / 2;
  }

  function rightBreakPoint(arc, directrix) {
    var rightArc = arc.N;
    if (rightArc) {
      return leftBreakPoint(rightArc, directrix);
    }

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
    var leftArc = arc.P,
      rightArc = arc.N;

    if (!leftArc || !rightArc) {
      return;
    }

    var leftSite = leftArc.site,
      cSite = arc.site,
      rightSite = rightArc.site;

    if (leftSite === rightSite) {
      return;
    }

    var bx = cSite.x,
      by = cSite.y,
      ax = leftSite.x - bx,
      ay = leftSite.y - by,
      cx = rightSite.x - bx,
      cy = rightSite.y - by;

    var d = 2 * (ax * cy - ay * cx);
    if (d >= -epsilon2) {
      return;
    }

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
        if (node.Left) node = node.Left;
        else {
          before = node.Previous;
          break;
        }
      } else {
        if (node.Right) node = node.Right;
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

  function Edge(leftSite, rightSite) {
    this.l = leftSite;
    this.r = rightSite;
    this.a = this.b = null; // for border edges
  }

  function createEdge(leftSite, rightSite, vertexA, vertexB) {
    var edge = new Edge(leftSite, rightSite);
    edges.push(edge);
    if (vertexA) setEdgeEnd(edge, leftSite, rightSite, vertexA);
    if (vertexB) setEdgeEnd(edge, rightSite, leftSite, vertexB);
    cells[leftSite.i].edges.push(createHalfEdge(edge, leftSite, rightSite));
    cells[rightSite.i].edges.push(createHalfEdge(edge, rightSite, leftSite));
    return edge;
  }

  function createBorderEdge(leftSite, vertexA, vertexB) {
    var edge = new Edge(leftSite, null);
    edge.a = vertexA;
    edge.b = vertexB;
    edges.push(edge);
    return edge;
  }

  function setEdgeEnd(edge, leftSite, rightSite, vertex) {
    if (!edge.a && !edge.b) {
      edge.a = vertex;
      edge.l = leftSite;
      edge.r = rightSite;
    } else if (edge.l === rightSite) {
      edge.b = vertex;
    } else {
      edge.a = vertex;
    }
  }

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
    var vertexB = edge.b;
    if (vertexB) return true;

    var vertexA = edge.a,
      leftSite = edge.l,
      rightSite = edge.r,
      lx = leftSite.x,
      ly = leftSite.y,
      rx = rightSite.x,
      ry = rightSite.y,
      fx = (lx + rx) / 2,
      fy = (ly + ry) / 2,
      fm,
      fb;

    if (ry === ly) {
      if (fx < x0 || fx >= x1) return;
      if (lx > rx) {
        if (!vertexA) vertexA = {
          x: fx,
          y: y0
        };
        else if (vertexA.y >= y1) return;
        vertexB = {
          x: fx,
          y: y1
        };
      } else {
        if (!vertexA) vertexA = {
          x: fx,
          y: y1
        };
        else if (vertexA.y < y0) return;
        vertexB = {
          x: fx,
          y: y0
        };
      }
    } else {
      fm = (lx - rx) / (ry - ly);
      fb = fy - fm * fx;
      if (fm < -1 || fm > 1) {
        if (lx > rx) {
          if (!vertexA) vertexA = {
            x: (y0 - fb) / fm,
            y: y0
          };
          else if (vertexA.y >= y1) return;
          vertexB = {
            x: (y1 - fb) / fm,
            y: y1
          };
        } else {
          if (!vertexA) vertexA = {
            x: (y1 - fb) / fm,
            y: y1
          };
          else if (vertexA.y < y0) return;
          vertexB = {
            x: (y0 - fb) / fm,
            y: y0
          };
        }
      } else {
        if (ly < ry) {
          if (!vertexA) vertexA = {
            x: x0,
            y: fm * x0 + fb
          };
          else if (vertexA.x >= x1) return;
          vertexB = {
            x: x1,
            y: fm * x1 + fb
          };
        } else {
          if (!vertexA) vertexA = {
            x: x1,
            y: fm * x1 + fb
          };
          else if (vertexA.x < x0) return;
          vertexB = {
            x: x0,
            y: fm * x0 + fb
          };
        }
      }
    }

    edge.a = vertexA;
    edge.b = vertexB;
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

  function createHalfEdge(edge, leftSite, rightSite) {
    var vertexA = edge.a,
      vertexB = edge.b;
    return new HalfEdge(edge, leftSite, rightSite ? Math.atan2(rightSite.y - leftSite.y, rightSite.x - leftSite.x) : edge.l === leftSite ? Math.atan2(vertexB.x - vertexA.x, vertexA.y - vertexB.y) : Math.atan2(vertexA.x - vertexB.x, vertexB.y - vertexA.y));
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
      node.Parent = // parent node
      node.Color = // color - true for red, false for black
      node.Left = // left node
      node.Right = // right node
      node.Previous = // previous node
      node.Next = null; // next node
  }

  RedBlackTree.prototype = {

    insert: function(after, node) {
      var parent, grandpa, uncle;

      if (after) {
        node.Previous = after;
        node.Next = after.Next;
        if (after.Next) after.Next.Previous = node;
        after.Next = node;
        if (after.Right) {
          after = after.Right;
          while (after.Left) after = after.Left;
          after.Left = node;
        } else {
          after.Right = node;
        }
        parent = after;
      } else if (this._) {
        after = RedBlackFirst(this._);
        node.Previous = null;
        node.Next = after;
        after.Previous = after.Left = node;
        parent = after;
      } else {
        node.Previous = node.Next = null;
        this._ = node;
        parent = null;
      }
      node.Left = node.Right = null;
      node.Parent = parent;
      node.Color = true;

      after = node;
      while (parent && parent.Color) {
        grandpa = parent.Parent;
        if (parent === grandpa.Left) {
          uncle = grandpa.Right;
          if (uncle && uncle.Color) {
            parent.Color = uncle.Color = false;
            grandpa.Color = true;
            after = grandpa;
          } else {
            if (after === parent.Right) {
              RedBlackRotateLeft(this, parent);
              after = parent;
              parent = after.Parent;
            }
            parent.Color = false;
            grandpa.Color = true;
            RedBlackRotateRight(this, grandpa);
          }
        } else {
          uncle = grandpa.Left;
          if (uncle && uncle.Color) {
            parent.Color = uncle.Color = false;
            grandpa.Color = true;
            after = grandpa;
          } else {
            if (after === parent.Left) {
              RedBlackRotateRight(this, parent);
              after = parent;
              parent = after.Parent;
            }
            parent.Color = false;
            grandpa.Color = true;
            RedBlackRotateLeft(this, grandpa);
          }
        }
        parent = after.Parent;
      }
      this._.Color = false;
    },

    remove: function(node) {
      if (node.Next) node.Next.P = node.Previous;
      if (node.Previous) node.Previous.N = node.Next;
      node.Next = node.Previous = null;

      var parent = node.Parent,
        sibling,
        left = node.Left,
        right = node.Right,
        next,
        red;

      if (!left) next = right;
      else if (!right) next = left;
      else next = RedBlackFirst(right);

      if (parent) {
        if (parent.Left === node) parent.Left = next;
        else parent.Right = next;
      } else {
        this._ = next;
      }

      if (left && right) {
        red = next.Color;
        next.Color = node.Color;
        next.Left = left;
        left.Parent = next;
        if (next !== right) {
          parent = next.Parent;
          next.Parent = node.Parent;
          node = next.Right;
          parent.Left = node;
          next.Right = right;
          right.Parent = next;
        } else {
          next.Parent = parent;
          parent = next;
          node = next.Right;
        }
      } else {
        red = node.Color;
        node = next;
      }

      if (node) node.Parent = parent;
      if (red) return;
      if (node && node.Color) {
        node.Color = false;
        return;
      }

      do {
        if (node === this._) break;
        if (node === parent.Left) {
          sibling = parent.Right;
          if (sibling.Color) {
            sibling.Color = false;
            parent.Color = true;
            RedBlackRotateLeft(this, parent);
            sibling = parent.Right;
          }
          if ((sibling.Left && sibling.Left.Color) || (sibling.Right && sibling.Right.Color)) {
            if (!sibling.Right || !sibling.Right.Color) {
              sibling.Left.Color = false;
              sibling.Color = true;
              RedBlackRotateRight(this, sibling);
              sibling = parent.Right;
            }
            sibling.Color = parent.Color;
            parent.Color = sibling.Right.Color = false;
            RedBlackRotateLeft(this, parent);
            node = this._;
            break;
          }
        } else {
          sibling = parent.Left;
          if (sibling.Color) {
            sibling.Color = false;
            parent.Color = true;
            RedBlackRotateRight(this, parent);
            sibling = parent.Left;
          }
          if ((sibling.Left && sibling.Left.Color) || (sibling.Right && sibling.Right.Color)) {
            if (!sibling.Left || !sibling.Left.Color) {
              sibling.Right.Color = false;
              sibling.Color = true;
              RedBlackRotateLeft(this, sibling);
              sibling = parent.Left;
            }
            sibling.Color = parent.Color;
            parent.Color = sibling.Left.Color = false;
            RedBlackRotateRight(this, parent);
            node = this._;
            break;
          }
        }
        sibling.Color = true;
        node = parent;
        parent = parent.Parent;
      } while (!node.Color);

      if (node) node.Color = false;
    }

  };

  function RedBlackRotateLeft(tree, node) {
    var p = node,
      q = node.Right,
      parent = p.Parent;

    if (parent) {
      if (parent.Left === p) parent.Left = q;
      else parent.Right = q;
    } else {
      tree._ = q;
    }

    q.Parent = parent;
    p.Parent = q;
    p.Right = q.Left;
    if (p.Right) p.Right.Parent = p;
    q.Left = p;
  }

  function RedBlackRotateRight(tree, node) {
    var p = node,
      q = node.Left,
      parent = p.Parent;

    if (parent) {
      if (parent.Left === p) parent.Left = q;
      else parent.Right = q;
    } else {
      tree._ = q;
    }

    q.Parent = parent;
    p.Parent = q;
    p.Left = q.Right;
    if (p.Left) p.Left.Parent = p;
    q.Right = p;
  }

  function RedBlackFirst(node) {
    while (node.Left) node = node.Left;
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
    return p.geometry.coordinates[0];
  }

  function pointY(p) {
    return p.geometry.coordinates[1];
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

  return function() {
    var point = {
      x: p.geometry.coordinates[0],
      y: p.geometry.coordinates[0]
    };
    x = point.x;
    y = point.y;
    fx = x;
    fy = y;
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
  };
};
