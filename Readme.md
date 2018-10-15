今天要写的这篇文章是关于 Promise 的，其实在谷歌一搜索，会出来很多有深度的关于Promise的文章，那为什么还要写这篇文章呢？

我相信一定有人用过 Promise ,但总有点似懂非懂的感觉，比如我们知道异步操作的执行是通过 then 来实现的，那后面的操作是如何得知前面异步操作完成的呢？以及一系列 Promise 背后的实现问题

所以我写这篇文章的目的主要是从最基础的点开始剖析，一步一步来理解 Promise 的背后实现原理

也是因为最近自己的困惑，后面边看文章，边调试代码，以至于对Promise的理解又上升了一个台阶~

# 为什么会有Promise的产生

我们可以想象这样一种应用场景，需要连续执行两个或者多个异步操作，每一个后来的操作都在前面的操作执行成功之后，带着上一步操作所返回的结果开始执行

采用setTimeout来模拟异步的运行，代码如下

```js
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
```

可以看到打印出来的结果并不是我们所期待的，那怎么解决这种异步操作带来的困扰呢？

在过去，我们会做多重的异步操作，比如

```js
doFirstThing((firstResult) => {
  doSecondThing(firstResult, (secondResult) => {
    console.log(`The secondResult is:` + secondResult)
  })
})
```

这种多层嵌套来解决一个异步操作依赖前一个异步操作的需求，不仅层次不够清晰，当异步操作过多，还会导致经典的回调地狱

那正确的打开方式是怎样的呢？Promise 提供了一个解决上述问题的模式，我们先回到上面那个多层异步嵌套的问题，接下来转变为 Promise 的实现方式，代码如下：

```js
function doFirstThing() {
  return new Promise((resolve,reject)=>{
    setTimeout(() => {
      console.log('获取第一个数据')
      let firstResult = 3 + 4
        resolve(firstResult)
    },400)
  })
}

function doSecondThing(firstResult) {
  console.log('获取第二个数据')
  let secondResult = firstResult * 5
  return secondResult
}

doFirstThing()
.then(firstResult => doSecondThing(firstResult))
.then(secondResult => {
  console.log(`The secondResult Result: ${secondResult}`
)})
.catch(err => {
  console.log('err',err)
})
```

可以看到结果就是我们预期得到的，需要注意的一点是，如果想要在回调中获取上个 Promise 中的结果，上个 Promise 中必须有返回结果

# Promise到底是什么

相信经过上面的应用场景，已经大致明白 Promise 的作用了，那它的具体定义是什么呢？

> Promise 是对异步编程的一种抽象，是一个代理对象，代表一个必须进行异步处理的函数返回的值或抛出的异常

简单来说，Promise 主要就是为了解决异步回调的问题，正如上面的例子所示

可以将异步对象和回调函数脱离开来，通过 then 方法在这个异步操作上面绑定回调函数

用 Promise 来处理异步回调使得代码层析清晰，便于理解，且更加容易维护，其主流规范目前主要是 [Promises/A+](http://promisesaplus.com/) ，下面介绍具体的API

## 状态和值

Promise 有3种状态: `pending` (待解决，这也是初始状态), `fulfilled` (完成）, `rejected` (拒绝)

> 状态只能由 `pending` 变为 `fulfilled` 或由 `pending` 变为 `rejected` ，且状态改变之后不会再发生变化，会一直保持这个状态

Promise 的值是指状态改变时传递给回调函数的值

## 接口

Promise 唯一接口 `then` 方法，它需要2个参数，分别是 `onResolved` 和 `onRejected`

并且需要返回一个 promise 对象来支持链式调用

Promise 的构造函数接收一个函数参数，参数形式是固定的异步任务，接收的函数参数又包含 `resolve` 和 `reject` 两个函数参数，可以用于改变 Promise 的状态和传入 Promise 的值

1. resolve：将 Promise 对象的状态从 `pending` (进行中)变为 `fulfilled` (已成功)

2. reject：将 Promise 对象的状态从 `pending` (进行中)变为 `rejected` (已失败)

3. resolve 和 reject 都可以传入任意类型的值作为实参，表示 Promise 对象成功( `fulfilled` )和失败( `rejected` )的值

了解了 Promise 的状态和值，接下来，我们开始讲解 Promise 的实现步骤

# Promise是怎样实现的

我们已经了解到实现多个相互依赖异步操作的执行是通过 then 来实现的，那重新回到最开始的疑问，后面的操作是怎么得知异步操作完成了呢？了解过 Vue 的童鞋应该知道一种发布/订阅模式，就是后面有一个函数在一直监听着前面异步操作的完成。 Promise 的实现貌似也有点发布/订阅的味道，不过它有 then 的链式调用，且没有 on/emit 这种很明显的订阅/发布的东西，让实现变得看起来有点复杂

在讲解 Promise 实现之前，我们还是先简要提一下发布/订阅模式：首先有一个事件数组来收集事件，然后订阅通过 on 将事件放入数组, emit 触发数组相应事件

那 Promise 呢？ Promise 内部其实也有一个数组队列存放事件, then 里边的回调函数就存放数组队列中。下面我们可以看下具体的实现步骤

## 实现promise雏形

( demo1 )

```js
class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
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

// 测试
var promise = new Promise((resolve, reject) => {
  resolve('promise')
})

promise.then(value => {
  console.log('value',value)
})
promise.then(value => {
  console.log('value',value)
})
```

上述代码很简单，大致的逻辑是：

通过构造器 `constructor` 定义 Promise 的初始状态和初始值，通过 Promise 的构造函数接收一个函数参数 `executor` , 接收的函数参数又包含 `resolve` 和 `reject` 两个函数参数，可以用于改变 Promise 的状态和传入 Promise 的值。

然后调用 then 方法，将 Promise 操作成功后的值传入回调函数

### 异步操作

相信有人会好奇，上述 Promise 实例中都是进行的同步操作，但是往往我们使用 Promise 都是进行的异步操作，那会出现怎样的结果呢？在上述例子上进行修改，我们用 setTimeout 来模拟异步的实现

```js
var promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise')
  },300)
})
```

会发现后面的回调函数中打印出来的值都是`undefined`

（图一）

很明显，这种错误的造成是因为 then 里边的回调函数在实例化 Promise 操作 resolve 或 reject 之前就执行完成了，所以我们应该设定触发回调函数执行的标识，也就是在状态和值发生改变之后再执行回调函数

正确的逻辑是这样的：

1. 调用 then 方法，将需要在 Promise 异步操作成功时执行的回调函数放入 children 数组队列中，其实也就是注册回调函数，类似于观察者模式

2. 创建 Promise 实例时传入的函数会被赋予一个函数类型的参数，即 `resolve` ( `reject` )，它接收一个参数 value ，代表异步操作返回的结果，当异步操作执行成功后，会调用 `resolve` ( `reject` )方法，这时候其实真正执行的操作是将 children 队列中的回调--执行

在 demo1 的基础上修改如下：

( demo2 )

```js
class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    this.children = [] // children为数组队列，存放多个回调函数
    executor(value => {
      this.status = 'resolve',
      this.setValue(value)
    }, reason => {
      this.status = 'rejected'
      this.setValue(reason)
    })
  }

  then (onResolved) {
    this.children.push(onResolved)
  }

  setValue (value) {
    this.value = value
    this.children.forEach(child => {
      child(this.value)
    })
  }
}

var promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise')
  },300)
})
promise.then(value => {
  console.log('value',value)
 })
```

首先实例化 Promise 时，传给 promise 的函数发送异步请求，接着调用 promise 对象的 then 函数，注册请求成功的回调函数，然后当异步请求发送成功时，调用 resolve ( rejected )方法，该方法依次执行 then 方法注册的回调数组

## 实现promise传宗接代

相信仔细的人应该可以看出来，then 方法应该能够支持链式调用，但是上面的初步实现显然无法支持链式调用

那怎样才能做到支持链式调用呢？其实实现也很简单：

```js
then(onResolved) {
  this.children.push(onResolved)
  return this
}
```

```js
var promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise')
  },300)
})
promise.then(value1 => {
  console.log('value1',value1)
}).then(value2 => {
  console.log('value2',value2)
})
```

then 方法中加入 `return this` 实现了链式调用，但如果需要在 then 回调函数中返回一个值 value 或者 promise ，传给下一个 then 回调函数呢？

先来看返回一个值 value 的情况，比如：

```js
promise.then(value1 => {
  console.log('value1',value1)
  let value = 'promise2'
  return value
 }).then(value2 => {
  console.log('value2',value2)
 })
```

在 demo2 的基础上进行改造：

( demo3 )

```js
then(onResolved) {
  var child = new Promise(() => {})
  child.onResolved = onResolved
  this.children.push(child)
  return this
}

setValue (value) {
  this.value = value
  this.children.forEach(child => {
    var ret = child.onResolved(this.value)
    this.value = ret
  })
}
```

原理就是在调用 Promise 对象的 then 函数时，注册所有请求成功的回调函数后,再后续在 setValue 函数中循环所有的回调函数，每次执行完一个回调函数就会更新 `this.value` 的值，然后将更新后的 `this.value` 传入下一个回调函数里，这样就解决了传值的问题

但这样也会出现一个问题，我们只考虑了串行 Promise 的情况下依次更新 `this.value` 的值，如果串行和并行一起呢？比如：

```js
// 串行
promise.then(value1 => {
  console.log('value1',value1)
  let value = 'promise2'
  return value
 }).then(value2 => {
  console.log('value2',value2)
 })

// 并行
promise.then(value1 => {
  console.log('value1',value1)
})
```

打印出来的结果最后一个 value1 为 undefined ，因为我们一直在改变 `this.value` 的值，并且在串行最后一个 then 回调函数中也显示设定返回值，默认返回 undefined

（图2）

可见 `return this` 并行不通，继续在 demo3 的基础上改造 then 和 setValue 函数如下：

( demo4 )

```js
then (onResolved) {
  var child = new Promise(() => {})
  child.onResolved = onResolved
  this.children.push(child)
  return child
}
setValue (value) {
  this.value = value
  this.children.forEach(child => {
    var ret = child.onResolved(this.value)
    child.setValue(ret)
  })
}
```

那如果 then 回调函数中返回一个 promise 呢？比如：

```js
promise.then(value1 => {
  console.log('value1',value1)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('promise2')
    },200)
  })
}).then(value2 => {
  console.log('value2',value2)
})
```

（图3）

很明显，打印出来的结果是个 Promise 。继续在 demo4 的基础上改造 setValue 函数

( demo5 )

```js
setValue (value) {
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
```

在 setValue 方法里面，我们对 value 进行了判断，如果是一个 promise 对象，就会调用其 then 方法，形成一个嵌套，直到其不是 promise 对象为止

到目前为止，我们已经实现了 Promise 的主要功能-'传宗接代'，状态和值的有序更新

## 实现promise错误处理

上面所有列举到的 demo 都是在异步操作成功的情况下进行的，但异步操作不可能都成功，在异步操作失败时，状态为标记为 `rejected` ，并执行注册的失败回调

`rejected` 失败的错误处理也类似于 `resolve` 成功状态下的处理，紧接着在 demo5 的注册回调、处理状态上加入新的逻辑，在 Promise 上加入 `resolve` 和 `reject` 静态函数

( demo6 )

```js
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
      onRejected: onRejected || (reason => Promise.reject(reason))
    })
    if (this.status !== 'pending') {
      child.triggerHandler(this.value, this.status)
    }
    return child
  }

  catch (onRejected) {
    return this.then(null, onRejected)
  }

  triggerHandler (parentValue, status) {
    var handler
    if (status === 'resolved') {
      handler = this.onResolved
    } else if (status === 'rejected') {
      handler = this.onRejected
    }
    this.setValue(handler(parentValue), 'resolved')
  }

  setValue (value, status) {
    if (value && value.then) {
      value.then(realValue => {
        this.setValue(realValue, 'resolved')
      }, reason => {
        this.setValue(reason, 'rejected')
      })
    } else {
      this.status = status
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
}
```

then 函数中有两个回调 handler, `onResolved` 和 `onResolved` ,分别表示成功执行的回调函数和是失败执行的回调函数，并设置默认值，保持链式连接

定义一个 `triggerHandler` 函数用来判断当前的 status ,并触发自己的 handler ,执行回调函数

setValue 函数同时设置 Promise 自己的状态和值，然后在重新设置新的状态之后循环遍历 children

为了更高效率的运行，在 then 函数中注册回调函数时加入状态判断，如果状态改变不为 `pending` ,说明 setValue 函数已经执行，状态已经发生了更改，就立马执行 triggerHandler函数；如果状态为 `pending` ,则在 setValue 函数执行时再触发 triggerHandle `函数

## Promise 中的 nextTick

`Promise/A+`规范要求 handler 执行必须是异步的, 具体可以参见标准 3.1 条

> Here “platform code” means engine, environment, and promise implementation code. In practice, this requirement ensures that onFulfilled and onRejected execute asynchronously, after the event loop turn in which then is called, and with a fresh stack. This can be implemented with either a “macro-task” mechanism such as setTimeout or setImmediate, or with a “micro-task” mechanism such as MutationObserver or process.nextTick. Since the promise implementation is considered platform code, it may itself contain a task-scheduling queue or “trampoline” in which the handlers are called

这里用 setTimeout 简单实现一个跨平台的 `nextTick`

```js
function nextTick(func) {
  setTimeout(func)
}
```

然后使用 `nextTick` 包裹 `triggerHandler`

```js
triggerHandler (status, parentValue) {
  nextTick(() => {
    var handler
    if (status === 'resolved') {
      handler = this.onResolved
    } else if (status === 'rejected') {
      handler = this.onRejected
    }
    this.setStatus('resolved', handler(parentValue))
  })
}
```

在 demo6 中我们实现了不管是异步还是同步都可以执行 triggerHandler ，那为什么要强制异步的要求呢？

主要是为了流程可预测，标准需要强制异步。可类比于经典的 image onload 问题

```js
var image=new Image();
imgae.onload = funtion;
imgae.src = 'url'
```

src 属性为什么需要写在 onload 事件后面？

因为 js 内部是按顺序逐行执行的，可以认为是同步的，给 image 赋值 src 时，去加载图片这个过程是异步的，这个异步过程完成后，如果有 onload ，则执行 onload 

如果先赋值 src ,那么这个异步过程可能在你赋值 onload 之前就完成了（比如图片缓存，或者是 js 由于某些原因被阻塞了），那么 onload 就不会执行

反之, js 同步执行确定 onload 赋值完成后才会赋值 src ,可以保证这个异步过程在 onload 赋值完成后才开始进行，也就保证了 onload 一定会被执行到

同样的，在Promise中，我们希望代码执行顺序是完全可以预测的，不允许出现任何问题

# 总结

上述 Promise 各个功能逻辑块的完整代码可见我的 github

需要注意的是：

1. promise 里面的 then 函数仅仅是注册了后续需要执行的回调函数，真正的执行是在 triggerHandler 方法里

2. then 和 catch 注册完回调函数后，返回的是一个新的 Promise 对象，以延续链式调用

3. 对于内部 pending 、fulfilled 和 rejected 的状态转变，通过 handler 触发 resolve 和 reject 方法，然后在 setValue 中更改状态和值