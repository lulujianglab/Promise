// Promise开枝散叶, 传宗接代
function nextTick(func) {
  setTimeout(func)
}

class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    this.children = []
    executor(value => {
      this.setValue(value, 'resolved')
    }, reason => {
      this.setValue(reason, 'rejected')
    })
  }

  then (onResolved, onRejected) {
    var child = new Promise(() => {})
    this.children.push(child)
    Object.assign(child, {
      onResolved: onResolved || (value => value),
      onRejected: onRejected || (reason => Promise.reject(reason)) // 返回promise的原因是要改变状态为rejected
    })
    if (this.status !== 'pending') {
      child.triggerHandler(this.value, this.status)
    }
    return child
  }

  catch (onRejected) {
    return this.then(null, onRejected)
  }

  format () {
    return {
      value: this.value,
      status: this.status,
      children: this.children.map(child => child.format())
    }
  }

  triggerHandler (parentValue, status) {
    nextTick(() => {
      var handler
      if (status === 'resolved') {
        handler = this.onResolved
      } else if (status === 'rejected') {
        handler = this.onRejected
      }
      this.setValue(handler(parentValue), 'resolved')
    })
  }

  setValue (value, status) {
    this.status = status
    if (value && value.then) {
      value.then(realValue => {
        this.setValue(realValue, 'resolved')
      }, reason => {
        this.setValue(reason, 'rejected')
      })
    } else {
      this.value = value
      this.children.forEach(child => {
        child.triggerHandler(value, status)
      })
    }
  }

  static resolve (value) {
    return new Promise(resolve => {
      resolve(value)
    })
  }

  static reject (reason) {
    return new Promise((resolve, reject) => {
      reject(reason)
    })
  }

  static all () { /* TODO */ }

  static race () { /* TODO */ }
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
  return value2 //
  // throw new Error('这里抛出一个异常e')
}).then(value3 => {
  console.log('value3',value3)
  return value3
}).catch(err => {
  console.log(err)
})

promise.then(value1 => {
  console.log('value1',value1)
})