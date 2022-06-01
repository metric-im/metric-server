import Formatter from './formatter.mjs';

export default class Map extends Formatter {
    constructor(dp,props) {
        super(dp,props);
        this.type = props[0]||'marker';
        this.apikey = this.dp.connector.profile.GOOGLE_API_KEY;
    }
    async render(res,data) {
        let trayStyle = "position:relative;display:flex;height:100vh;width:100vh";
        let containerStyle = "flex:1 0;height:100%;width:100%;align-self:center";
        let scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${this.apikey}&callback=initMap`
        let head = `<meta charset="utf-8"><script async src="${scriptSrc}"></script>`;
        let bodyStyle = `margin:0;padding:0;border:0`;
        let body = `<div style="${trayStyle}"><div id="container" style="${containerStyle}"></div></div>`;
        data = data.filter(r=>(r.latitude!==null&&r.longitude!==null&&r.site!==null));

        let script = `
            <script lang="JavaScript">
                function initMap() {
                    let map = new google.maps.Map(document.getElementById('container'), {
                        center: {lat:${data[0].latitude}, lng: ${data[0].longitude}},
                        zoom: 8
                    });
                    ${this.typeRender[this.type](data)}
                }
                window.initMap = initMap;
            </script>`;
        let html = `<!DOCTYPE html>\n<html>\n<head>${head}</head>\n<body style="${bodyStyle}">\n${body}\n${script}\n</body>\n</html>`;
        res.send(html);
    }
    get typeRender()  {
        return {
            marker:(data)=>{
                return data.map((r)=>{
                    let latLng = `new google.maps.LatLng(${r.latitude},${r.longitude})`
                    return `new google.maps.Marker({map:map,position:${latLng},title:"${this.constructTitle(r)}"})`;
                }).join('; ');
            },
            polyline:(data)=>{
                let path = data.map((r)=>`{lat:${r.latitude},lng:${r.longitude}}`).join(',');
                return `new google.maps.Polyline({map:map,path:[${path}]})`
            }
        }
    }
    constructTitle(r) {
        return Object.entries(r).reduce((keys,[k,v])=>{
            if (k!=='latitude' && k!=='longitude') keys.push(k+": "+v);
            return keys;
        },[]).join(', ');
    }
}
