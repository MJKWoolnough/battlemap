const queue: (() => Promise<any>)[] = [],
      done = () => {
	const fn = queue.shift();
	if (fn) {
		fn().finally(done);
	} else {
		locked = false;
	}
      };

let locked = false;

export default (fn: () => Promise<any>) => {
	if (locked) {
		queue.push(fn);
	} else {
		locked = true;
		fn().finally(done);
	}
};


