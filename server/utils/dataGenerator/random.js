class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  nextDecimal(min, max, decimals = 2) {
    const value = this.nextFloat(min, max);
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  choice(arr) {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  randomDate(start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + this.next() * (endTime - startTime);
    return new Date(randomTime);
  }

  randomBoolean(probability = 0.5) {
    return this.next() < probability;
  }

  randomString(length, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.nextInt(0, chars.length - 1)];
    }
    return result;
  }
}

function createRandom(seed) {
  return new SeededRandom(seed);
}

module.exports = { createRandom, SeededRandom };
