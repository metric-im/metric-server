# server
Metric IM server for pinging, linking and reporting

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
* _event - event name or "ping"
* _account - authorized account or "public"

## Deployment Configuration
plantuml requires java
```bash
sudo apt-get install -y openjdk-8-jdk
sudo apt-get install -y graphviz
```
Install dotenv globally
```bash
sudo npm i -g dotenv
```


** NOTES
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
   31  sudo nano metric.conf
   32  ls -al
   33  sudo rm default 
   34  history
   35  sudo systemctl start nginx
   36  sudo nano /lib/systemd/system/metric.service
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
