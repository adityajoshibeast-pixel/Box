const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Menu app server (local) running on port ${PORT}`));