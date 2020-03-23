const redis = require('redis');
const moment = require('moment');

const redisClient = redis.createClient();

function limitRate(config) {
  let MAX_REQUESTS = config.max_requests || 5;
  let MINUTES_INTERVAL = config.minutes_interval || 1;
  let INTERVAL_SUBDIVISION = config.interval_subdivision || 10;

  console.log("MAX REQUESTS: ", MAX_REQUESTS)
  console.log("MINUTES INTERVAL: ", MINUTES_INTERVAL)
  console.log("INTERVAL SUBDIVISION: ", INTERVAL_SUBDIVISION)

  return (req, res, next) => {
    try {
        if (!redisClient) {
          //console.error('Redis client is null');
          throw new Error('Redis client is null');
          process.exit(1);
        }
        
        // check for existing records
        redisClient.get(req.ip, function(err, record) {
          if (err) throw err; // log error
          
          const currentRequestTime = moment();
  
          if (record == null) {
            
            // create new record
            console.log("Record is null", record);
  
            let newRecord = [];
            let requestLog = {
              requestTimestamp: currentRequestTime.unix(),
              requestCount: 1
            };
  
            newRecord.push(requestLog);
            redisClient.set(req.ip, JSON.stringify(newRecord), 'EX', 60 * 5); // TODO set expire time to config
            
            return next();
          }
  
          // record found
          let data = JSON.parse(record);
          let intervalTimestamp = moment()
            .subtract(MINUTES_INTERVAL, 'minutes')
            .unix();
  
          // get logs within interval
          let relevantRequests = data.filter(entry => {
            return entry.requestTimestamp > intervalTimestamp;
          });
  
          console.log('requests within interval', relevantRequests);
          let totalWindowRequestsCount = relevantRequests.reduce((accumulator, entry) => {
            return accumulator + entry.requestCount;
          }, 0);
  
          // check for max requests
          if (totalWindowRequestsCount >= MAX_REQUESTS) {
            res
              .status(413)
              .send(
                `Max ${MAX_REQUESTS} requests allowed`
              );
          } else {
            // limit has not been exceeded
            
            if(relevantRequests.length > 0){
              let lastRequestLog = relevantRequests[relevantRequests.length - 1];
              let limitTimeSubdivision = currentRequestTime
              .subtract(INTERVAL_SUBDIVISION, 'seconds')
              .unix();
            
              console.log("last", lastRequestLog.requestTimestamp, ", subdiv", limitTimeSubdivision)

              // check for subdivision availability first 
              if (lastRequestLog.requestTimestamp > limitTimeSubdivision) {
                lastRequestLog.requestCount++;
                data[data.length - 1] = lastRequestLog;
              } else {
                  console.log('always else')
                  // or create new log
                  data.push({
                    requestTimestamp: currentRequestTime.unix(),
                    requestCount: 1
                  });
              }
            }            
             else {
              console.log('always else')
              // or create new log
              data.push({
                requestTimestamp: currentRequestTime.unix(),
                requestCount: 1
              });
            }
  
            redisClient.set(req.ip, JSON.stringify(data), 'EX', 60 * 5);
            next();
          }
        });
    } catch (error) {
        next(error);
    }
  }
}

module.exports = limitRate;
