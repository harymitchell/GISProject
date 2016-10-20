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
 */
function InverseDistanceWeighting (timeDomain,delimeter,factorTimeForNeighbors) {
    
    // Node modules
    var fs = require('fs');
    var math = require('math');
        
    var points = {};
    
    // Default constant settings
    if (!timeDomain) timeDomain = "DAY"; //time domain is day, month, or year
    if (!delimeter) delimeter = '\t'
    if (!factorTimeForNeighbors) factorTimeForNeighbors = true; // should time be in between a valid neighbor's t1 and t2?
    
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
     * TODO: find better time value than epoch time
     */
    var normalizedTimeForMeasurement = function(measurement){
        var result;
        if (timeDomain=="DAY") {
            result = new Date(measurement.year, measurement.month, measurement.day).getTime()*3.17098e-13;
        } else {
            // TODO: implement other timeDomains
        }
        //console.log (measurement, result)
        return result;
    }
     
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
                    day: line[3]
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
        //console.log ("calculate neighbors"+x,y,k)
        
        var result = []; // {id: d}
        
        // calculate all euclideanDistance(p1,p2,q1,q2) and isTimeValid.
        Object.keys(points).forEach(function(key) {
            var p = points[key];
            result.push({
                            id: p.id,
                            d: euclideanDistance(x, y,p.x, p.y),
                            measurements: p.measurements,
                            isTimeValid: factorTimeForNeighbors && t >= normalizedTimeForMeasurement(p.measurements[0]) && t <= normalizedTimeForMeasurement(p.measurements[p.measurements.length-1])
                        }) 
        });
        
        // custom sort list of d
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
        
        // logging for debug
        //result.forEach(function(e){
        //   console.log (e.id, e.d, e.isTimeValid, normalizedTimeForMeasurement(e.measurements[0]), normalizedTimeForMeasurement(e.measurements[e.measurements.length-1])); 
        //});
        
        // return top k
        return result.slice(0,k)
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
        var ti2 = normalizedTimeForMeasurement(neighbor.measurements[measurementsLength-1]);
        var ti1 = normalizedTimeForMeasurement(neighbor.measurements[0]);
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
     * Callback to handle data read from file.
     * TODO: let's make this cleaner with Promises :)
     */
    var handleData = function(data){
        var list = data.split("\r\n") // splits on carriage returns
        list.forEach(function(e){
            var split = e.split(delimeter); // input file is delemited
            var pointId = split[0];
            var currentPoint = points[pointId];
            if (currentPoint) {
                // if we already have a value for pointId in points, add the new measurement
                currentPoint.measurements.push (newMeasurementForLine(split));
            } else if (pointId != '' && pointId != 'id') {
                // New point entry
                points[pointId]=newPointForLine(split);   
            }        
        });
        
        // TODO: turn these into tests
        //console.log (JSON.stringify(points["10030010"].measurements[9]));
        //console.log (Object.keys(points))
        //console.log (nearestNeighbors(-85, 30, 6, points));
        console.log ("\n"+idw(-85, 30, normalizedTimeForMeasurement({year: 2009, month: 4, day: 10}), 6, 3, points));
        console.log ("\n"+idw(-85, 30, normalizedTimeForMeasurement({year: 2009, month: 7, day: 20}), 6, 3, points));
        console.log ("\n"+idw(-120, 30, normalizedTimeForMeasurement({year: 2009, month: 12, day: 10}), 6, 3, points));
    };
    
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
    
    /**
     * Interpolate from given raw String data.
     *
     */
    this.interpolateFromData = function(data){
        handleData(data);
    }
    
    /**
     * Interpolate from given file path
     * 
     * TODO: return output STRING or write to file...
     */
    this.interpolateFromFilePath = function(filePath){
        readDataAndExecute(filePath,this.interpolateFromData);
    }
    
}

// Exports
exports.InverseDistanceWeighting = InverseDistanceWeighting;

// Usage (main)
if (require.main === module) {
    var path = require('path');
    var filePath = path.join(__dirname, 'pm25_2009_measured.txt');
    var inverseDistanceWeighting = new InverseDistanceWeighting();
    inverseDistanceWeighting.interpolateFromFilePath(filePath);
}