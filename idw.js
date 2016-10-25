/**
 * InverseDistanceWeighting function.
 *
 * In this object we have some other object definitions implied, but which I was too lazy to define explicitly, the are:
 *
 * Measurement ::=
 *  pm25
 *  year
 *  month
 *  day
 *  normalized
 *
 * Point ::=
 *  id
 *  x
 *  y
 *  measurements[]
 *
 * Neighbor ::=
 *  id
 *  isTimeValid
 *  d
 *
 *
 *  NOTE: Profiling: https://nodejs.org/en/docs/guides/simple-profiling/
 *
 */
function InverseDistanceWeighting () {
    
    // cache for nearest neighbor process
    var neighborCache = {};
    
    /**
     * http://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366
     */
    Date.prototype.isLeapYear = function() {
        var year = this.getFullYear();
        if((year & 3) != 0) return false;
        return ((year % 100) != 0 || (year % 400) == 0);
    };

    // Get Day of Year
    Date.prototype.getDOY = function() {
        var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var mn = this.getMonth();
        var dn = this.getDate();
        var dayOfYear = dayCount[mn] + dn;
        if(mn > 1 && this.isLeapYear()) dayOfYear++;
        return dayOfYear;
    };
    
    // Node modules
    var fs = require('fs');
    var math = require('math');
    var each = require ('async/each');
            
    // Default constant settings
    var timeDomain = "year month day"; //time domain is day, month, or year
    var delimeter = '\t'
    var factorTimeForNeighbors = true; // should time be in between a valid neighbor's t1 and t2?
    var epochTimeScale = 3.17098e-13;
    
    /**
     * Returns the 2D Euclidean Distance for provided points.
     * See https://en.wikipedia.org/wiki/Euclidean_distance
     */
    var euclideanDistance = function(p1,p2,q1,q2) {
        var result = math.sqrt( math.pow((q1-p1),2) + math.pow((q2-p2),2) );
        //console.log ("d = math.sqrt( ("+q1+"-"+p1+")^2 + ("+q2+"-"+p2+")^2",p1,p2,q1,q2,result)
        return result;
    }
    
    /**
     * Returns a normalized time integer given the Measurement object.
     *
     * Requirements:
     * there are three possible time domains: (year), (year, month), and (year, month, day),
     * where year, month, and day are all integers with month∈[1, 12] and day∈[1, 31].
     * 
     * TODO: find better time value than epoch time converted to centuries (epoch*3.17098e-13)
     */
    var normalizedTimeForMeasurement = function(measurement){
        var result;
        switch (timeDomain){
            case "Year Month Day":
                result = new Date(measurement.year, measurement.month-1, measurement.day).getDOY()//.getTime()*epochTimeScale;
                break;
            case "Year Month":
                result = new Date(measurement.year, measurement.month-1).getTime().getDOY();
                break;
            case "Year":
                result = new Date(measurement.year).getTime().getDOY();
                break;
            default:
                console.error("Invalid time Domain: "+timeDomain);
                console.error("Dafaulting to year");
                result = new Date(measurement.year).getTime().getDOY();
        }
        //console.log (measurement, result)
        return result;
    }
     
    /**
     * Reads data from filePath and calls the provided callback on the data.
     */
    var readDataAndExecute = function (filePath,callback){
        fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
            if (!err){
                callback(data);
            }else{
                console.error(err);
            }
        });
    };
    this.readDataAndExecute = readDataAndExecute;
    
    /**
     * Returns a new point object for given list
     */
    var newPointForLine = function(line) {
        return {
                    id: line[0],
                    x: line[4],
                    y: line[5],
                    measurements: [newMeasurementForLine(line)]
                };
    };
     
    /**
     * Returns a new measurement object for given list.
     */
    var newMeasurementForLine = function(line) {
        return {
                    pm25: line[6],
                    year: line[1],
                    month: line[2],
                    day: line[3],
                    normalized: normalizedTimeForMeasurement ({year: line[1], month: line[2], day: line[3]})
                };
    };
        
    /**
     * Finds the k nearest neighbors to x, y, and t, given points.
     *
     * 1) Iterate points, calculating euclideanDistance and isTimeValid, and push all into result list.
     * 2) Sort the result list.
     * 3) Return the top k results.
     * 
     */
    var nearestNeighbors = function(x,y,t,k,points){        
        var cacheKey = x+","+y;
        var cachedNeighbors = neighborCache[cacheKey]; // will be a list of all points sorted by euclidean distance only.
                        
        if (cachedNeighbors && factorTimeForNeighbors) {
            //console.log ("1st calculate neighbors",k, cacheKey, cachedNeighbors? cachedNeighbors.length : null)
            // must find neighbors in cache and discard those where the time wasn't sampled for t
            var result = [];
            var p, i = 0;
            while (result.length < k) {
                p = cachedNeighbors[i]; 
                if (t >= p.measurements[0].normalized && t <= p.measurements[p.measurements.length-1].normalized) {
                    //console.log ("pushing",t,p.measurements[0].normalized,p.measurements[p.measurements.length-1].normalized)
                    result.push(p);
                } else {
                    //console.log ("ignoring",t,p.measurements[0].normalized,p.measurements[p.measurements.length-1].normalized)
                }
                i++;
            }
            //console.log (JSON.stringify(result.map (function(m){return {id: m.id, d: m.d}})))
            return result.slice(0,k);
        } else if (cachedNeighbors) {
            //console.log ("2nd calculate neighbors",k, cacheKey, cachedNeighbors? cachedNeighbors.length : null)
            // easy, just return first k neighbors in cache (disregarding time)
            return cachedNeighbors.slice(0,k)
        } else {
            //console.log ("3rd calculate neighbors",k, cacheKey, cachedNeighbors? cachedNeighbors.length : null)
            // must build the neighbor cache entry for cacheKey, then recurse
            var neighbors = [];
            Object.keys(points).forEach(function(key) {
                var p = points[key];
                neighbors.push({
                                id: p.id,
                                d: euclideanDistance(x, y,p.x, p.y),
                                measurements: p.measurements
                            })
            });
            // Sort with custom sort algorithm 
            var sorter = new QuickSort (isLessThanOrEqualDistance);
            sorter.sort(neighbors);
            // add neighbors to neighborCache at cacheKey
            neighborCache[cacheKey] = neighbors;
            //console.log ("neihgbors",JSON.stringify(neighbors.slice(0,k).map (function(m){return m.d})))//{id: m.id, d: m.d}})))
            // now when we recurse, we will have a cachedNeighbors entry
            return nearestNeighbors(x,y,t,k,points);
        }
    };
    
    /**
     * IDW weight function
     *
     */
    var idwWeight = function(k,p,neighbor,neighbors){
        var denom = 0;
        var i;
        for (i=0;i<k;i++) {
            denom += math.pow (1/neighbors[i].d,p);
        }
        var result = math.pow(1/neighbor.d,p) / denom;
        //console.log ("idwWeight:",result)
        return result;
    };
    
    /**
     * IDW interpolated value function
     * Assume the value at node i at time t1 is wi1, and at time t2 the value is wi2.
     * ( ti2 - t / ti2 - ti1 )*wi1 + ( t - ti1 / ti2 - ti1 )*wi2;
     */
    var interpolatedValue = function(t,neighbor){
        var measurementsLength = neighbor.measurements.length;
        var ti2 = neighbor.measurements[measurementsLength-1].normalized;
        var ti1 = neighbor.measurements[0].normalized;
        var wi2 = neighbor.measurements[measurementsLength-1].pm25;
        var wi1 = neighbor.measurements[0].pm25;
        var result = (( (ti2 - t) / (ti2 - ti1) )*wi1) + (( (t - ti1) / (ti2 - ti1) )*wi2);
        //console.log ("interpolatedValue",t, ti1, ti2,wi1,wi2,result); //t, ti1, ti2,
        return result;
    };
       
    /**
     * Main Inverse Distance Weighting function.
     *
     * x is the x coordinate
     * y is the y coordinate
     * t is the time value
     * k is the number of neighbors
     * p is the power
     * allPoints is the set of data to use
     */
    var idw = function(x,y,t,k,p,allPoints){
        var weight, valueInterpolated, sumOfWeightByValue = 0, sumOfWeights = 0;
        var neighbors = nearestNeighbors(x,y,t,k,allPoints);
        neighbors.forEach(function(neighbor){        
            weight = idwWeight (k,p,neighbor,neighbors);
            sumOfWeights += weight;
            valueInterpolated = interpolatedValue (t,neighbor);
            sumOfWeightByValue += weight*valueInterpolated;
        });
        return sumOfWeightByValue / sumOfWeights;
    };
    
    /**
     * Takes raw data input and returns points object.
     * 
     * An input data set is assumed to have the format of (id, [time], x, y, measurement),
     *  which records a set of measured values at location (x, y) and a time instance.
     */
    var inputPointsForData = function(data){
        var result = {};
        var list = data.split("\r\n") // splits on carriage returns
        list.forEach(function(e){
            var split = e.split(delimeter); // input file is delemited
            var pointId = split[0];
            var currentPoint = result[pointId];
            if (currentPoint) {
                // if we already have a value for pointId in points, add the new measurement
                currentPoint.measurements.push (newMeasurementForLine(split));
            } else if (pointId != '' && pointId != 'id') {
                // New point entry
                result[pointId]=newPointForLine(split);   
            }        
        });
        return result;
    };
    
    /**
     * Takes raw locations data input and returns locations object.
     * 
     * The data set is assumed to have the format of (id, x, y) with id as integers and x & y as floating point numbers.
     */
    var locationsForData = function(data){
        var result = {};
        var list = data.split("\r\n") // splits on carriage returns
        list.forEach(function(e){
            var split = e.split(delimeter); // input file is delemited
            result[split[0]] = {
                            id: split[0],
                            x:  split[1],
                            y:  split[2]
                        };
        });
        return result;
    };
    
    /**
     * Interpolate from given object containing raw String data and settings:
     *
     *   {
     *       k: k neighbors,
     *       p: p power,
     *       t: timeDomain,
     *       n: n filename
     *       dataset: raw data
     *       locations: locations to interpolate in dataset
     *   }
     *
     */
    this.interpolateFromData = function(obj){
        var start = new Date();
        
        timeDomain = obj.t;
        
        // calculate a points obj from inputted dataset
        var points = inputPointsForData(obj.dataset);
        
        // calculate a locations obj from inputted dataset
        var locations = locationsForData(obj.locations);
        
        //console.log ("\n"+idw(-85, 30, normalizedTimeForMeasurement({year: 2009, month: 4, day: 10}), 6, 3, points));
        //console.log ("\n"+idw(-85, 30, normalizedTimeForMeasurement({year: 2009, month: 7, day: 20}), 6, 3, points));
        //console.log ("\n"+idw(-120, 30, normalizedTimeForMeasurement({year: 2009, month: 12, day: 10}), 6, 3, points));
            
        // Asynchronously interpolate
        var results = [];
        var measurements = [];
        var date = new Date(2009,0,1);
        console.log ("building measurements list");
        for (i=0;i<365;i++){
            measurements.push ({
                                normalized: normalizedTimeForMeasurement({year: date.getFullYear(), month: date.getMonth()+1, day: date.getDate()}),
                                year: date.getFullYear(),
                                month: date.getMonth()+1,
                                day: date.getDate()
                               });
            date.setDate(date.getDate()+1)
        }
        console.log ("iternating locations");
        each(Object.keys(locations), function(locID, callback) {
            if (locID && locID != 'id') {
                var value, loc, i, date;
                loc = locations[locID];
                each(measurements, function(measurement){            
                    value = idw(loc.x, loc.y, measurement.normalized, obj.k, obj.p, points);
                    //console.log ([locID, measurement.year, measurement.month, measurement.day, loc.x, loc.y, value]) // debug
                    results.push ([locID, measurement.year, measurement.month, measurement.day, loc.x, loc.y, value])
                }, function(err){
                    if( err ) {
                        console.log('A meansurement failed to process');
                    } else {
                        console.log ('A location is complete',locID);
                    }
                });
            }
        }, function(err) {
            if( err ) {
                console.log('A location failed to process');
            } else {
                console.log('All locations have been processed successfully');
                console.log (results);
            }
        });
        console.log ("done interpolating",results.length);
        var end = new Date();
        var diffMs = (end - start);
        var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes
        console.log ("done interpolating "+ results.length+" records, in "+diffMins+"mins");
        
        var resultString = "";
        results.forEach(function(res){
            resultString += res+"\n";
        })
        
        fs.writeFile(obj.n, resultString, function(err) {
            if(err) {
                return console.log(err);
            }
        }); 
        
        // TODO: turn these into tests
        //console.log (JSON.stringify(points["10030010"].measurements[9]));
        //console.log (Object.keys(points))
        //console.log (nearestNeighbors(-85, 30, 6, points));        
    }
    
    /*
     * Sorting algorithm function
     * http://blog.mgechev.com/2012/11/24/javascript-sorting-performance-quicksort-v8/
     */
    var QuickSort = function (isLessThanOrEqual) {
        
        function partition(array, left, right) {
            var cmp = array[right - 1],
                minEnd = left,
                maxEnd;
            for (maxEnd = left; maxEnd < right - 1; maxEnd += 1) {
                if (isLessThanOrEqual(array[maxEnd], cmp)) {
                    swap(array, maxEnd, minEnd);
                    minEnd += 1;
                }
            }
            swap(array, minEnd, right - 1);
            return minEnd;
        }
    
        function swap(array, i, j) {
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
            return array;
        }
    
        function quickSort(array, left, right) {
            if (left < right) {
                var p = partition(array, left, right);
                quickSort(array, left, p);
                quickSort(array, p + 1, right);
            }
            return array;
        }
    
        this.sort = function (array) {
            quickSort(array, 0, array.length);
        };
    };
    
    /**
     * Custom sort logic: is a less than b?
     * We consider distance d and isTimeValid
     */
    var isLessThanOrEqualCustom = function(a, b){
        if (factorTimeForNeighbors) {
            if (a.isTimeValid && b.isTimeValid) {
                // pass
            } else if (a.isTimeValid) {
                return true;
            } else {
                return false;
            }
        }
        if (a.d < b.d) {
            return true;
        }
        if (a.d > b.d) {
            return false;
        }
        return true; // equal
    };    
    
    /**
     * Sort logic: is a less than b?
     * We consider only distance d 
     */
    var isLessThanOrEqualDistance= function(a, b){
        if (a.d < b.d) {
            return true;
        }
        if (a.d > b.d) {
            return false;
        }
        return true; // equal
    };    
    
    /**
     * Interpolate from given file path
     * 
     */
    this.interpolateFromFilePath = function(k,p,n,inputFilePath,locationFilePath,timeDomain){
        interpolateFromData = this.interpolateFromData;
        readDataAndExecute(inputFilePath,function(data){
            readDataAndExecute(locationFilePath,function(locations){
                interpolateFromData({
                                        k: k,
                                        p: p,
                                        t: timeDomain,
                                        n: n,
                                        dataset: data,
                                        locations: locations
                                    })
            });
        });    
    }
}

// Exports
exports.InverseDistanceWeighting = InverseDistanceWeighting;

// Usage (main)
if (require.main === module) {
    var path = require('path');
    var inputFilePath = path.join(__dirname, 'pm25_2009_measured.txt');
    var inputLocationPath = path.join(__dirname, 'county_xy.txt');
    var inverseDistanceWeighting = new InverseDistanceWeighting();
    inverseDistanceWeighting.interpolateFromFilePath(6,3,"out.txt",inputFilePath, inputLocationPath, "Year Month Day");
}

/**
 * NOTES:
 *                 
    custom native sort list of d, proved much slower than manual implementation
    
    result.sort(function(a,b){
        if (factorTimeForNeighbors) {
            if (a.isTimeValid && b.isTimeValid) {
                // pass
            } else if (a.isTimeValid) {
                return -1;
            } else {
                return 1;
            }
        }
        if (a.d < b.d) {
            return -1;
        }
        if (a.d > b.d) {
            return 1;
        }
        return 0; 
    });       
        
 *
 *
    SYNCHRONOUS, not sure if actually slower
    
    iternate locations object and add the interpolated value for each location, based on the points object
    idw = function(x,y,t,k,p,allPoints)
    var value, loc, i, date, measurement;
    var results = [];
    Object.keys(locations).forEach(function(locID) {
       loc = locations[locID];
       date = new Date(2009,0,1);
       for (i=0;i<365;i++){
           measurement = normalizedTimeForMeasurement({year: date.getFullYear(), month: date.getMonth()+1, day: date.getDate()})
           value = idw(loc.x, loc.y, measurement, obj.k, obj.p, points);
           console.log (loc.x, loc.y, measurement, obj.k, obj.p, value)
           //console.log ([locID, measurement.year, measurement.month, measurement.day, loc.x, loc.y, value]) // debug
           results.push ([locID, date.getFullYear(), date.getMonth()+1, date.getDate(), loc.x, loc.y, value])
           // increment date
           date.setDate(date.getDate()+1)
       }
    });
    console.log(results);
 *
 *
 *
 *
        //////////////////////////////////////// idw Pre-cache version: ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        //console.log ("calculate neighbors"+x,y,k)
        
        //var result = []; // {id: d}
        //
        //// calculate all euclideanDistance(p1,p2,q1,q2) and isTimeValid.
        //Object.keys(points).forEach(function(key) {
        //    var p = points[key];
        //    result.push({
        //                    id: p.id,
        //                    d: euclideanDistance(x, y,p.x, p.y),
        //                    measurements: p.measurements,
        //                    isTimeValid: factorTimeForNeighbors && t >= p.measurements[0].normalized && t <= p.measurements[p.measurements.length-1].normalized
        //                })
        //});
        //    
        //// Sort with custom sort algorithm 
        //var sorter = new QuickSort (isLessThanOrEqualCustom);
        //sorter.sort(result);
        //
        //// logging for debug
        ////result.forEach(function(e){
        ////   console.log (e.id, e.d, e.isTimeValid, normalizedTimeForMeasurement(e.measurements[0]), normalizedTimeForMeasurement(e.measurements[e.measurements.length-1])); 
        ////});
        //
        //// return top k
        //console.log ("neighbors",JSON.stringify(result.slice(0,k).map (function(m){return {id: m.id, d: m.d}})))
        //return result.slice(0,k)
 *
 *
 *
 *
 */