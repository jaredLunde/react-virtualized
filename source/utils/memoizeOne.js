const stringify = args => `${args[0]},${args[1]},${args[2]},${args[3]}`

export default fn => {
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