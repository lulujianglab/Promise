// 解决Promise返回的也是Promise的问题
class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    this.onResolved = undefined
    this.children = []
    executor(value => {
      this.status = 'resolve',
      this.setValue(value)
    }, reason => {
      this.status = 'rejected'
      this.setValue(reason)
    })
  }

  then(onResolved) {
    var child = new Promise(() => {})
    child.onResolved = onResolved
    this.children.push(child)
    return child
  }

  setValue (value) {
    // console.log('set value', value)
    if (value && value.then) {
      value.then(realValue => {
        this.setValue(realValue)
      })
    } else {
      this.value = value
      this.children.forEach(child => {
        var ret = child.onResolved(this.value)
        child.setValue(ret)
      })
    }
  }
}

var promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise1')
  },300)
})

promise.then(value1 => {
  console.log('value1',value1)
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(new Promise(resolve2 => {
        setTimeout(() => {
          resolve2('promise2')
        }, 300)
      }))
    }, 300)
  })
}).then(value2 => {
  console.log('value2',value2)
  value2 = 'promise3'
  return value2
}).then(value3 => {
  console.log('value3',value3)
  return value3
})

promise.then(value1 => {
  console.log('value1',value1)
})