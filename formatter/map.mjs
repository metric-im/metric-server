import Formatter from './formatter.mjs';

export default class Map extends Formatter {
    constructor(dp,props) {
        super(dp,props);
        this.type = props[0]||'marker';
        this.zoom = props[1]||2;
        this.apikey = this.dp.connector.profile.GOOGLE_API_KEY;
    }
    async render(res,data) {
        let trayStyle = "position:relative;display:flex;height:100vh";
        let containerStyle = "flex:1 0;height:100%;width:100%;align-self:center";
        let scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${this.apikey}&loading=async&callback=initMap&libraries=visualization`
        let head = `<meta charset="utf-8"><script defer src="${scriptSrc}"></script>`;
        let bodyStyle = `margin:0;padding:0;border:0`;
        let body = `<div style="${trayStyle}"><div id="container" style="${containerStyle}"></div></div>`;
        data = data.filter(r=>(r.latitude!==null&&r.longitude!==null&&r.site!==null));
        let longAvg = data.reduce((sum,item)=>{return sum+=item.longitude},0)/data.length;
        let latAvg = data.reduce((sum,item)=>{return sum+=item.latitude},0)/data.length;

        let script = (data.length === 0)?`
            <script lang="JavaScript">
                document.getElementById('container').innerHTML = "<div style='margin:20px'>No data available</div>";
            </script>\`;
        `:`
            <script async lang="JavaScript">
                async function initMap() {
                    let map = new google.maps.Map(document.getElementById('container'), {
                        center: {lat:${latAvg}, lng: ${longAvg}},
                        zoom: ${this.zoom}
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
            path:(data)=>{
                let path = data.map((r)=>`{lat:${r.latitude},lng:${r.longitude}}`).join(',');
                return `new google.maps.Polyline({map:map,path:[${path}]})`
            },
            heat:(data)=>{
                // if there is a count provided use weighted location
                let locations = data.map((r)=>r.hasOwnProperty("_count")
                    ?`{location:new google.maps.LatLng(${r.latitude},${r.longitude}),weight:${r._count}}`
                    :`new google.maps.LatLng(${r.latitude},${r.longitude})`).join(',');
                return `new google.maps.visualization.HeatmapLayer({map:map,data:[${locations}],radius:100})`
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
