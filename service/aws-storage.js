const AWS = require('aws-sdk');
const fs = require('fs');

class AwsStorage {
  constructor(config) {
    Object.assign(this, config);
    AWS.config.update({
      accessKeyId: this.accessKey || process.env.ACCESS_KEY,
      secretAccessKey: this.secretKey || process.env.SECRET_KEY,
      region: this.region || process.env.REGION
    });
  }

  async uploadFileToS3({
    file,
    fileName,
    bucket,
    contentType,
    cacheControl,
    contentDisposition,
    s3FolderName
  }) {
    const base64data = this.checkBufferData(file);

    const s3 = new AWS.S3();
    try {
      const response = await s3.putObject({
        Bucket: bucket,
        Key: `${s3FolderName}/${fileName}`,
        Body: base64data,
        ContentDisposition: contentDisposition || 'inline',
        ContentType: contentType,
        CacheControl: cacheControl || 'max-age=86400,no-cache',
      }).promise();

      console.log('S3 Upload Successful:', response);
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  }

  checkBufferData(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (data instanceof Uint8Array) {
      return Buffer.from(data);
    }

    if (typeof data === 'string') {
      return fs.readFileSync(data); // only for file paths
    }

    throw new Error('Unsupported data type for S3 upload');
  }

  getDistributedLink(fileName) {
    return `${this.distribution}/${fileName}`;
  }

  invalidate(invalidateList) {
    const cloudfront = new AWS.CloudFront();
    return cloudfront.createInvalidation({
      DistributionId: process.env.DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: new Date().getTime().toString(),
        Paths: {
          Quantity: invalidateList.length,
          Items: invalidateList,
        },
      },
    }).promise();
  }
}

module.exports = AwsStorage;
