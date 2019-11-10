class WaitGroup {
    private count : number;
    constructor(count: number) { this.count = count; }

    done() {
        if (this.count > 0) {
            this.count--;
        }
    }

    async wait() {
        let self = this;
        await new Promise(function(resolve) {
            self.waitUntil(resolve);
        });
    }

    private waitUntil(resolve: any) {
        let self = this;
        if (this.count <= 0) {
            resolve();
        } else {
            setTimeout(function(){
                self.waitUntil(resolve);
            }, 0);
        }
    }
}

export { WaitGroup };