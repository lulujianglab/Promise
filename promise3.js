// 解决Promise内部是异步函数的问题：将then函数先存入数组队列，等到执行resolve或者reject时再触发.then函数
class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    this.children = [] // children为数组，存放多个回调
    executor(value => {
      this.status = 'resolve',
      this.setValue(value)
    }, reason => {
      this.status = 'rejected'
      this.setValue(reason)
    })
  }

  then(onResolved) {
    console.log(2)
    this.children.push(onResolved)
    return this 
  }

  setValue (value) {
    console.log(4)
    this.value = value
    this.children.forEach(child => {
      console.log(5)
      child(this.value)
    })
  }
}

var promise = new Promise((resolve, reject) => {
  console.log(1)
  setTimeout(() => {
    console.log(3)
    resolve('promise')
  },300)
})
promise.then(value => {
  console.log('value',value)
}).then(value => {
  console.log('value',value)
})