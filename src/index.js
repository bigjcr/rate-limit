const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimiter = require('./api/rate-limiter');
const properties = require('./config/properties');


const app = express();

const router = express.Router();

router.get('/', (req, res) => {
    res.send('hello, it\'s me');
})

app.use(cors());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(
    bodyParser.json({
        type: 'application/json'
    })
);

app.use(rateLimiter({
    max_requests: process.env.MAX_REQUESTS || 5,
    minutes_interval: process.env.MINUTES_INTERVAL || 1,
    interval_subdivision: process.env.INTERVAL_SUBDIVISION || 10
}));
app.use('/api', router);

app.listen(properties.PORT, () => {
    console.log(`Running at ${properties.PORT}`);
});