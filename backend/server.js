const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());
const CLIENT_ID = 'Ov23liJhNGTZSCc3nyi0';
const CLIENT_SECRET = '226473ce60cc802e7abc9d3e0e34e162e62b3cb8';

app.post('/auth/github/callback', async (req, res) => {
    const { code } = req.body;

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const tokenData = tokenResponse.data;
        const accessToken = tokenData.access_token;

        if (accessToken) {
            // Use this access token to fetch user details or other tasks.
            // Maybe generate a JWT and send it to the frontend for session management.
            res.json({ success: true, accessToken });
        } else {
            res.json({ success: false, error: 'Failed to get access token' });
        }
    } catch (error) {
        console.error('Error during GitHub authentication:', error);
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});