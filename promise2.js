// 加入then函数，传入回调函数
class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    this.children = []
    executor(value => {
      this.status = 'resolve',
      this.value = value
    }, reason => {
      this.status = 'rejected'
      this.value = reason
    })
  }

  then(onResolved) {
    onResolved(this.value)
  }
}

var promise = new Promise((resolve, reject) => {
  resolve('promise')
})

promise.then(value => {
  console.log('value',value)
})
promise.then(value => {
  console.log('value',value)
})
promise.then(value => {
  console.log('value',value)
})