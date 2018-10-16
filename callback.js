function doFirstThing() {
  setTimeout(() => {
    console.log('获取第一个数据')
    let firstResult = 3 + 4
    return firstResult
  },400)
}

function doSecondThing(firstResult) {
  console.log('获取第二个数据')
  let secondResult = firstResult * 5
  return secondResult
}

try {
  let firstResult = doFirstThing();
  let secondResult = doSecondThing(firstResult);
} catch(err) {
  console.log('err',err)
}