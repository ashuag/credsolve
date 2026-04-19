/**
 * Shape of files produced by Nest/Express multer in-memory storage.
 * Avoids `Express.Multer.File` (Express v5 typings no longer expose `Multer` consistently).
 */
export type UploadedFileLike = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};
