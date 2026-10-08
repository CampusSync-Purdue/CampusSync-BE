import type { Request, Response } from 'express'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from '../constants/httpStatus.js'
import {
  EmailAlreadyRegisteredError,
  registerUser,
} from '../services/userService.js'
import { validateRegisterInput } from '../validation/registerValidation.js'

export async function register(request: Request, response: Response) {
  const validation = validateRegisterInput(request.body)

  if (!validation.valid) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: validation.errors,
    })

    return
  }

  try {
    const user = await registerUser(validation.value)

    response.status(HTTP_STATUS_CREATED).json({
      message: 'Your account has been created.',
      user,
    })
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      // 409 rather than 400: the input is well formed, the email is just taken.
      response.status(HTTP_STATUS_CONFLICT).json({
        message: error.message,
        errors: { email: error.message },
      })

      return
    }

    // Log server-side, return a generic message so no internals are exposed.
    console.error('Failed to register user', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to create your account right now. Please try again.',
    })
  }
}
