const defaultStringify = args => `${args[0]},${args[1]},${args[2]},${args[3]}`

export default (fn, stringify = defaultStringify) => {
  let args, value

  return function () {
    const argString = stringify(arguments)

    if (argString === args) {
      return value
    }

    args = argString
    value = fn.apply(this, arguments)
    return value
  }
}