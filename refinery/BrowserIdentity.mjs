export default class BrowserIdentity {
    constructor(connector) {
        this.connector = connector;
        this.description = 'Parse the User Agent for device and browser type';
        this.requires = [];
        this.provides = [
            {_id:'device',dataType:"string",accumulator:"addToSet"},
            {_id:'browser',dataType:"string",accumulator:"addToSet"}
        ];
    }
    async process(context,event) {
        if (!context.ua) {
            event.device = 'unknown';
            return;
        }
        if (/iP(hone|od)|android.+mobile|BlackBerry|IEMobile/i.test(context.ua)) {
            event.device = 'phone';
        } else if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(context.ua)) {
            event.device = 'tablet';
        } else {
            event.device = 'desktop';
        }
        if (/android/i.test(context.ua)) {
            event.browser = 'android';
        }
        if (/iphone/i.test(context.ua)) {
            event.browser = 'iphone';
        }
        if (/chrome/i.test(context.ua) && !/chromium/i.test(context.ua)) {
            event.browser = 'chrome';
        }
        if (/firefox/i.test(context.ua) && !/seamonkey/i.test(context.ua)) {
            event.browser = 'firefox';
        }
        if (/safari/i.test(context.ua) && !/chrom/i.test(context.ua)) {
            event.browser = 'safari';
        }
        if (/edge/i.test(context.ua) && !/chrom/i.test(context.ua) && !/safari/i.test(context.ua)) {
            event.browser = 'edge';
        }
        if (/msie/i.test(context.ua)) {
            event.browser = 'explorer';
        }
    }
}
