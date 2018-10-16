class Promise {
  constructor (executor) {
    this.value = undefined
    this.status = 'pending'
    executor(value => {
      this.status = 'resolve',
      this.value = value
      console.log('value',this.value)
    }, reason => {
      this.status = 'rejected'
      this.value = reason
      console.log('value',this.value)
    })
  }
}
var promise = new Promise((resolve, reject) => {
  // console.log(resolve, '\n', reject)
  resolve('promise')
})