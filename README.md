# server
Metric IM server for pinging, linking and reporting

## Usage

### Web Api
See https://metric.im/#Wiki/MetricReference for url syntax

### Import Api
A host may import metric-server `import MetricServer from '@metric-im/metric-server'` and invoke the Api
directly.
```javascript
import MetricServer from '@metric-im/metric-server'
const metricApi = await MetricServer.getApi(componentry.connector.db,{});
app.get('/metric/ping/*',async (req,res)=>{
  let eventBody = metricApi.initializeEvent('AccountName',req);
  await metricApi.ping(Object.assign(eventBody)); // Ping body is namespace and custom data
  res.status(200).send();
})
```
NOTE: AccountName is arbitrary. MetricServer does not employ Access Control when imported
client...
```javascript
// Record an event for namespace, 'view', with attributes given in the query string
await API.get(`/metric/ping/view?page=${this.context.page}`)
```

## Reserved Attribute Names
* year - YYYY
* monthName - January, February, ...
* month - 1-12
* day - 1-31
* hour - 0-60
* minute - 0-60
* second - 0-60
* week - 1-52
* weekday - Sunday, Monday, ...
* date - YYYY-MM-DD
* _time - now
* _ns - event name space or "ping"
* _account - authorized account or "public"

## Deployment Settings
plantuml requires java
```bash
sudo apt-get install -y openjdk-8-jdk
sudo apt-get install -y graphviz
```
Install dotenv globally
```bash
sudo npm i -g dotenv
```
### Node
```bash
cd ~
curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install nodejs
```
### Mongo
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```
Set up authentication by creating a system user. tmp admin pwd is legotorino. tmp metric
password is kingpeanutfig
```javascript
use admin
db.createUser({user: "admin",pwd: passwordPrompt(),roles: [{ role: "userAdminAnyDatabase", db: "admin" },{ role: "readWriteAnyDatabase", db: "admin" }]})
use metric
db.createUser({user:"metric",pwd:passwordPrompt(),roles:[{role:"readWrite",db:"metric"}]})

db.auth("myUserAdmin", passwordPrompt())
db.createUser({user:"metric",pwd:passwordPrompt(),roles:[{role:"readWrite",db:"metric"}]})
```
Edit /etc/mongod.conf to set `security: authorization enabled`, and to add the servers
address to `net: bindIp`

> Note: I named the machine "metric" in /etc/hostname so the setting for bindIp can be
> `bindIp: localhost,metric`

## Metric Server
uses platuml which needs graphviz DOT
```bash
sudo apt install default-jre
sudo apt install graphviz
cd /opt
sudo chown ubuntu /opt
mkdir metric
cd metric
git clone git@github.com:metric-messenger/server.git
cd server
npm i
```

## NOTES
```bash
    4  sudo chown /opt ubuntu
    5  sudo chown ubuntu /opt
    6  cd /opt
    7  mkdir metric
    8  ls
    9  cd metric
   10  ssh-keygen -t rsa -C "ubuntu@metric.im"
   11  cd ~
   12  cd .ssh
   13  more id_rsa.pub 
   14  eval $(ssh-agent)
   15  ssh-add ~/.ssh/id_rsa
   16  cd /opt
   17  cd metric/
   18  ls
   19  git clone git@github.com:metric-messenger/server.git
   20  ls
   21  cd server/
   22  cd /etc/nginx/
   23  ls
   24  sudo systemctl start neginx
   25  sudo systemctl start nginx
   26  ps -ef | grep nginx
   27  wget http://localhost
   28  curl http://localhost
   29  cd sites-enabled/
   30  ls
   31  sudo nano pub-market.conf
   32  ls -al
   33  sudo rm default 
   34  history
   35  sudo systemctl start nginx
   36  sudo nano /lib/systemd/system/pub-market.service
   37  cd /opt
   38  ls
   39  cd metric
   40  ls
   41  cd server/
   42  ls
   43  npm i
   44  sudo yum install java-1.8.0-openjdk
   45  sudo npm install java-1.8.0-openjdk
   46  java -version
   47  sudo apt-get install openjdk-8-jdk
   48  java -version
   49  sudo apt-get install -y graphviz
```
