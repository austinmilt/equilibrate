beforeEach(async () => {
  setTestIsReady(true);
});

afterEach(async () => {
  setTestIsReady(false);
});

// a hack to prevent mocha from calling functions that arent
// part of tests
let readyStatus: boolean = false;
export function setTestIsReady(ready: boolean): void {
  readyStatus = ready;
}

export function testIsReady(): boolean {
  return readyStatus;
}
