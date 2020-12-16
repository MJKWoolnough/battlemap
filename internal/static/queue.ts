let p = Promise.resolve();

export default (fn: () => Promise<any>) => p = p.finally(fn);
