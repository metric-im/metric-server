/**
 * Generate a unique alphanumeric id which will be sortable by date to the millisecond.
 * This is used in place of mongo's ObjectId in most circumstances.
 */
class Id {
    static get new() {
        let id = Number(Date.now()).toString(36);
        for (let i=0;i<8;i++) id += Number(Math.round(Math.random()*35)).toString(36);
        return id;
    }
}
module.exports = Id;